import { SignJWT, importPKCS8 } from 'jose';
import type { SchedulingProvider, TimePeriod, Event, Booking } from './types.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const TIMEZONE = 'Asia/Taipei';

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
          timeZone: TIMEZONE,
          items: [{ id: config.calendarId }],
        }),
      });

      await assertOk(response, 'query freebusy');

      const data = (await response.json()) as { calendars: Record<string, { busy: TimePeriod[] }> };
      return data.calendars[config.calendarId]?.busy ?? [];
    },

    // 查詢指定時間範圍內的事件列表,包含 eventId,供取消功能比對使用
    async getEvents(start: string, end: string): Promise<Event[]> {
      const accessToken = await getAccessToken();
      const params = new URLSearchParams({
        timeMin: start,
        timeMax: end,
        timeZone: TIMEZONE,
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
          summary: string;
          start: { dateTime: string };
          end: { dateTime: string };
        }[];
      };

      return data.items.map((item) => ({
        eventId: item.id,
        summary: item.summary,
        start: item.start.dateTime,
        end: item.end.dateTime,
      }));
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
          start: { dateTime: booking.start, timeZone: TIMEZONE },
          end: { dateTime: booking.end, timeZone: TIMEZONE },
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
