import { SignJWT, importPKCS8 } from 'jose';
import z from 'zod';
import { toAbsoluteTime } from '../../core/time.ts';
import type {
  Event,
  EventLabel,
  EventQuery,
  NewEvent,
  SchedulingProviderDefinition,
  TimePeriod,
} from './types.ts';

export const GoogleCalendarSettingsSchema = z.object({
  serviceAccountEmail: z.string().min(1),
  privateKey: z.string().min(1),
  calendarId: z.string().min(1),
});

// Google 回傳的事件,只宣告我們會讀的欄位
interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  extendedProperties?: { private?: Record<string, string> };
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export const googleCalendarProvider: SchedulingProviderDefinition = {
  name: 'google-calendar',

  create(settings) {
    const parsed = GoogleCalendarSettingsSchema.safeParse(settings);
    if (!parsed.success) return null;

    const { serviceAccountEmail, calendarId } = parsed.data;
    const privateKey = parsed.data.privateKey.replace(/\\n/g, '\n');
    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;
    const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    let cachedToken: { accessToken: string; expiresAt: number } | null = null;
    let cachedTimeZone: string | null = null;

    // 用 Service Account 私鑰簽 JWT 換取 access token,快取到過期前 60 秒
    async function getAccessToken(): Promise<string> {
      if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
        return cachedToken.accessToken;
      }

      const jwt = await new SignJWT({ scope: CALENDAR_SCOPE })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .setIssuer(serviceAccountEmail)
        .setAudience(TOKEN_URL)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(await importPKCS8(privateKey, 'RS256'));

      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      await assertOk(response, 'obtain Google access token');

      const data = (await response.json()) as { access_token: string; expires_in: number };
      cachedToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      console.log('Google Calendar: 已更新快取token');
      return cachedToken.accessToken;
    }

    // 全天事件的邊界要用日曆自己的時區換算。時區幾乎不會變,和 token 一樣快取
    async function getCalendarTimeZone(): Promise<string> {
      if (cachedTimeZone) return cachedTimeZone;

      const accessToken = await getAccessToken();
      const response = await fetch(calendarUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      await assertOk(response, 'get calendar');

      const data = (await response.json()) as { timeZone: string };
      cachedTimeZone = data.timeZone;
      return cachedTimeZone;
    }

    return {
      // 查詢指定時間範圍內已被佔用的時段,直接回傳 Google 的結果,不做任何計算
      async getBusyPeriods({ start, end }: TimePeriod): Promise<TimePeriod[]> {
        const accessToken = await getAccessToken();
        const response = await fetch(FREEBUSY_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeMin: start,
            timeMax: end,
            items: [{ id: calendarId }],
          }),
        });

        await assertOk(response, 'query freebusy');

        const data = (await response.json()) as {
          calendars: Record<string, { busy: TimePeriod[]; errors?: { reason: string }[] }>;
        };

        // 日曆 ID 錯誤或沒有權限時 Google 仍回 200,錯誤藏在 errors 欄位;
        // 不檢查的話會拿到空的 busy,AI 誤以為所有時段都可預約
        const calendar = data.calendars[calendarId];
        if (!calendar || calendar.errors?.length) {
          throw new Error(
            `Failed to query freebusy: ${JSON.stringify(calendar?.errors ?? 'calendar not in response')}`,
          );
        }
        return calendar.busy;
      },

      // 查詢事件列表，包含 eventId，供取消與改期比對使用
      async getEvents({ start, end, ownerId, limit }: EventQuery): Promise<Event[]> {
        const accessToken = await getAccessToken();
        const params = new URLSearchParams({
          timeMin: start,
          timeMax: end,
          singleEvents: 'true',
          orderBy: 'startTime',
          eventLabelVersion: '1',
        });
        // 精確比對,所以 maxResults 才是「這位顧客的前 N 筆」而不是「模糊結果的前 N 筆」
        if (ownerId) params.set('privateExtendedProperty', `ownerId=${ownerId}`);
        if (limit) params.set('maxResults', String(limit));

        const response = await fetch(`${eventsUrl}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        await assertOk(response, 'list events');

        const data = (await response.json()) as { items: GoogleEvent[]; timeZone: string };

        return data.items.map((item) => ({
          eventId: item.id,
          summary: item.summary ?? '(無標題)',
          description: item.description,
          ownerId: item.extendedProperties?.private?.ownerId,
          ...toPeriod(item, data.timeZone),
        }));
      },

      async getEvent(eventId: string): Promise<Event | null> {
        const accessToken = await getAccessToken();
        const response = await fetch(
          `${eventsUrl}/${encodeURIComponent(eventId)}?eventLabelVersion=1`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        // 410是已刪除Event、404是不存在Event
        if (response.status === 404 || response.status === 410) return null;
        await assertOk(response, 'get event');

        const data = (await response.json()) as GoogleEvent;

        return {
          eventId: data.id,
          summary: data.summary ?? '(無標題)',
          description: data.description,
          ownerId: data.extendedProperties?.private?.ownerId,
          ...toPeriod(data, await getCalendarTimeZone()),
        };
      },

      // 標籤定義在日曆上，每本日曆各自一組
      async getLabels(): Promise<EventLabel[]> {
        const accessToken = await getAccessToken();
        const response = await fetch(calendarUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        await assertOk(response, 'get calendar');

        const data = (await response.json()) as {
          labelProperties?: {
            eventLabels?: { id: string; name?: string; backgroundColor: string }[];
          };
        };

        return (data.labelProperties?.eventLabels ?? []).map((label) => ({
          id: label.id,
          name: label.name ?? '',
          color: label.backgroundColor,
        }));
      },

      // 在日曆上建立一筆事件
      async createEvent(event: NewEvent): Promise<{ eventId: string }> {
        const accessToken = await getAccessToken();
        const response = await fetch(`${eventsUrl}?eventLabelVersion=1`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(toGoogleEventBody(event)),
        });

        await assertOk(response, 'create event');

        const data = (await response.json()) as { id: string };
        return { eventId: data.id };
      },

      // 整筆取代，未送出的欄位會被清空，所以呼叫端要給完整內容
      async updateEvent(eventId: string, event: NewEvent): Promise<void> {
        const accessToken = await getAccessToken();
        const response = await fetch(
          `${eventsUrl}/${encodeURIComponent(eventId)}?eventLabelVersion=1`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(toGoogleEventBody(event)),
          },
        );

        await assertOk(response, 'update event');
      },

      // 取消(刪除)指定 eventId 的預約
      async deleteEvent(eventId: string): Promise<void> {
        const accessToken = await getAccessToken();
        const response = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        await assertOk(response, 'cancel event');
      },
    };
  },
};

// 統一處理 fetch 回應失敗的情況
async function assertOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  const body = (await response.text()).replace(/\s+/g, ' ').trim();
  throw new Error(`Failed to ${action}: ${response.status} ${response.statusText} ${body}`);
}

// 建立與更新的 body 完全相同(更新是 PUT 整筆取代)
function toGoogleEventBody(event: NewEvent) {
  return {
    summary: event.summary,
    description: event.description,
    eventLabelId: event.labelId,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
    extendedProperties: { private: { ownerId: event.ownerId } },
  };
}

// 全天事件(公休、休假)只有 date 沒有 dateTime,而且 Google 的 end.date 是隔天,
// 所以當天 00:00 到隔天 00:00 正好是整天。邊界用日曆自己的時區換算成絕對時間
function toPeriod(item: GoogleEvent, calendarTimeZone: string): TimePeriod {
  return {
    start: item.start.dateTime ?? toAbsoluteTime(`${item.start.date!}T00:00`, calendarTimeZone),
    end: item.end.dateTime ?? toAbsoluteTime(`${item.end.date!}T00:00`, calendarTimeZone),
  };
}
