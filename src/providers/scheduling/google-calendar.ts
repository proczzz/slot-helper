import { SignJWT, importPKCS8 } from 'jose';
import type { Booking, Event, SchedulingProvider, TimePeriod } from './types.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// 統一處理 fetch 回應失敗的情況
async function assertOk(response: Response, action: string): Promise<void> {
  if (!response.ok) {
    throw new Error(`Failed to ${action}: ${response.status} ${response.statusText}`);
  }
}

// 建立 Google Calendar 的 SchedulingProvider 實作
// token 快取放在 closure 內,確保不同 config(不同店家)各自獨立
export function createGoogleCalendarProvider(config: {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
}): SchedulingProvider {
  let cachedToken: CachedToken | null = null;
  const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`;

  // 用 Service Account 私鑰簽 JWT 換取 access token,快取到過期前 60 秒
  async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return cachedToken.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      iss: config.clientEmail,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(await importPKCS8(config.privateKey, 'RS256'));

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
    
    console.log('google日曆:已更新快取token');
    return cachedToken.accessToken;
  }

  return {
    // 查詢指定時間範圍內已被佔用的時段,直接回傳 Google 的結果,不做任何計算
    async getBusyPeriods(start: string, end: string): Promise<TimePeriod[]> {
      const accessToken = await getAccessToken();
      const response = await fetch(FREEBUSY_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: start,
          timeMax: end,
          items: [{ id: config.calendarId }],
        }),
      });

      await assertOk(response, 'query freebusy');

      const data = (await response.json()) as {
        calendars: Record<string, { busy: TimePeriod[]; errors?: { reason: string }[] }>;
      };

      // 日曆 ID 錯誤或沒有權限時 Google 仍回 200,錯誤藏在 errors 欄位;
      // 不檢查的話會拿到空的 busy,AI 誤以為所有時段都可預約
      const calendar = data.calendars[config.calendarId];
      if (!calendar || calendar.errors?.length) {
        throw new Error(
          `Failed to query freebusy: ${JSON.stringify(calendar?.errors ?? 'calendar not in response')}`,
        );
      }
      return calendar.busy;
    },

    // 查詢指定時間範圍內的事件列表,包含 eventId,供取消功能比對使用
    async getEvents(start: string, end: string): Promise<Event[]> {
      const accessToken = await getAccessToken();
      const params = new URLSearchParams({
        timeMin: start,
        timeMax: end,
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      const response = await fetch(`${eventsUrl}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      await assertOk(response, 'list events');

      const data = (await response.json()) as {
        items: {
          id: string;
          summary?: string; // 沒填標題的事件不會回傳此欄位
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
            start: item.start.dateTime!,
            end: item.end.dateTime!,
          }))
      );
    },

    // 在日曆上建立一筆預約事件
    async createBooking(booking: Booking): Promise<{ eventId: string }> {
      const accessToken = await getAccessToken();
      const response = await fetch(eventsUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: booking.summary,
          description: booking.description,
          start: { dateTime: booking.start },
          end: { dateTime: booking.end },
        }),
      });

      await assertOk(response, 'create event');

      const data = (await response.json()) as { id: string };
      return { eventId: data.id };
    },

    // 取消(刪除)指定 eventId 的預約
    async cancelBooking(eventId: string): Promise<void> {
      const accessToken = await getAccessToken();
      const response = await fetch(`${eventsUrl}/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      await assertOk(response, 'cancel event');
    },
  };
}
