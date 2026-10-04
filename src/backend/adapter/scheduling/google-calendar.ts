import { SignJWT, importPKCS8 } from 'jose';
import z from 'zod';
import type {
  Event,
  EventCriteria,
  EventLabel,
  NewEvent,
  SchedulingProviderDefinition,
  TimePeriod,
} from './types.ts';

const SettingsSchema = z.object({
  serviceAccountEmail: z.string().min(1),
  privateKey: z.string().min(1),
  calendars: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).min(1),
});

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export const googleCalendarProvider: SchedulingProviderDefinition = {
  name: 'google-calendar',

  create(settings) {
    const parsed = SettingsSchema.safeParse(settings);
    if (!parsed.success) return null;

    const { serviceAccountEmail, calendars } = parsed.data;
    const privateKey = parsed.data.privateKey.replace(/\\n/g, '\n');
    // 目前只用第一本日曆,多本之後再做
    const calendarId = calendars[0]!.id;
    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;
    const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    let cachedToken: { accessToken: string; expiresAt: number } | null = null;

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
      async getEvents({ start, end, keyword, limit }: EventCriteria): Promise<Event[]> {
        const accessToken = await getAccessToken();
        const params = new URLSearchParams({
          timeMin: start,
          singleEvents: 'true',
          orderBy: 'startTime',
        });
        if (end) params.set('timeMax', end);
        if (keyword) params.set('q', keyword); // 全文搜尋，會比對標題、說明等欄位
        if (limit) params.set('maxResults', String(limit));

        const response = await fetch(`${eventsUrl}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        await assertOk(response, 'list events');

        const data = (await response.json()) as {
          items: {
            id: string;
            summary?: string;
            description?: string;
            start: { dateTime?: string; date?: string };
            end: { dateTime?: string; date?: string };
          }[];
        };

        return (
          data.items
            // 全天事件(公休、休假)只有 date 沒有 dateTime,不是預約,略過
            .filter((item) => item.start.dateTime && item.end.dateTime)
            .map((item) => ({
              eventId: item.id,
              summary: item.summary ?? '(無標題)',
              description: item.description,
              start: item.start.dateTime!,
              end: item.end.dateTime!,
            }))
        );
      },

      async getEvent(eventId: string): Promise<Event> {
        const accessToken = await getAccessToken();
        const response = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        await assertOk(response, 'get event');

        const data = (await response.json()) as {
          id: string;
          summary?: string;
          description?: string;
          start: { dateTime?: string; date?: string };
          end: { dateTime?: string; date?: string };
        };

        return {
          eventId: data.id,
          summary: data.summary ?? '(無標題)',
          description: data.description,
          start: data.start.dateTime ?? data.start.date!,
          end: data.end.dateTime ?? data.end.date!,
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
        const response = await fetch(eventsUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.start },
            end: { dateTime: event.end },
          }),
        });

        await assertOk(response, 'create event');

        const data = (await response.json()) as { id: string };
        return { eventId: data.id };
      },

      // 整筆取代，未送出的欄位會被清空，所以呼叫端要給完整內容
      async updateEvent(eventId: string, event: NewEvent): Promise<void> {
        const accessToken = await getAccessToken();
        const response = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.start },
            end: { dateTime: event.end },
          }),
        });

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
