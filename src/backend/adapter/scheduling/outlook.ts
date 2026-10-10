import z from 'zod';
import { toPresetColor } from './outlook-colors.ts';
import { getAccessToken, OutlookOauthSchema, type OutlookOauthSettings } from './outlook-oauth.ts';
import type {
  Event,
  EventLabel,
  EventQuery,
  NewEvent,
  SchedulingProviderDefinition,
  TimePeriod,
  TokenStore,
} from './types.ts';

// OAuth 設定加上日曆 ID。缺任何一個都代表還沒設定完,create 會回 null、功能關著
export const OutlookSettingsSchema = OutlookOauthSchema.extend({
  calendarId: z.string().min(1),
});

export interface OutlookCalendar {
  id: string;
  name: string;
  isDefault: boolean;
}

const GRAPH = 'https://graph.microsoft.com/v1.0';

// 歸屬存在擴充屬性。PS_PUBLIC_STRINGS 這個命名空間的字串屬性在 Outlook 介面上看不到,
// 但查詢得到 —— 等同 Google 的 extendedProperties.private
const OWNER_PROPERTY = 'String {00020329-0000-0000-C000-000000000046} Name ownerId';
const OWNER_EXPAND = `singleValueExtendedProperties($filter=id eq '${OWNER_PROPERTY}')`;

const SELECT = 'id,subject,bodyPreview,start,end';

// getBusyPeriods、getEvents一次最多取幾筆。
const MAX_ITEMS = '300';

// Graph 回的事件,只宣告我們會讀的欄位
interface GraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  showAs?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  singleValueExtendedProperties?: { id: string; value: string }[];
}

const CALENDARS_URL = `${GRAPH}/me/calendars?$select=id,name,isDefaultCalendar,canEdit&$top=50`;

// 設定階段選擇日曆用的。選定日曆之前還沒有 calendarId，所以這支不經過 provider。
// 只有 api 介面可以取得 Outlook 的日曆 id，所以能讓老闆下拉選單挑
export async function fetchOutlookCalendars(
  settings: OutlookOauthSettings,
  tokens: TokenStore,
): Promise<OutlookCalendar[]> {
  const accessToken = await getAccessToken(settings, tokens);
  if (!accessToken) return [];

  const response = await fetch(CALENDARS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  await assertOk(response, 'list Outlook calendars');

  const data = (await response.json()) as {
    value: { id: string; name: string; isDefaultCalendar?: boolean; canEdit?: boolean }[];
  };

  // 我們要寫入事件,唯讀的日曆選了也沒用。undefined 當成可以,不要誤殺
  return data.value
    .filter((item) => item.canEdit !== false)
    .map((item) => ({
      id: item.id,
      name: item.name,
      isDefault: item.isDefaultCalendar === true,
    }));
}

export const outlookProvider: SchedulingProviderDefinition = {
  name: 'outlook',

  create(settings, tokens) {
    const parsed = OutlookSettingsSchema.safeParse(settings);
    if (!parsed.success) return null;

    const { calendarId, ...oauth } = parsed.data;
    const calendarUrl = `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}`;

    // 事件的單筆操作走 /me/events —— event id 是帳號層級唯一的,
    // 而歸屬由 core 的 findOwnEvent 用 ownerId 擋,不需要再靠路徑限制日曆
    function eventUrl(eventId: string): string {
      return `${GRAPH}/me/events/${encodeURIComponent(eventId)}`;
    }

    async function authorize(): Promise<string> {
      const accessToken = await getAccessToken(oauth, tokens);
      // 設定齊全但沒授權(老闆解除連結後 calendarId 還留著)
      if (!accessToken) throw new Error('Outlook 尚未授權,請到後台重新連結');
      return accessToken;
    }

    // Prefer 讓 Graph 一律用 UTC 回時間,否則每個事件各自回建立時的時區
    async function call(url: string, init?: RequestInit): Promise<Response> {
      const accessToken = await authorize();
      return fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'outlook.timezone="UTC"',
          ...init?.headers,
        },
      });
    }

    return {
      async getBusyPeriods(range: TimePeriod): Promise<TimePeriod[]> {
        const params = new URLSearchParams({
          startDateTime: range.start,
          endDateTime: range.end,
          $select: 'id,showAs,start,end',
          $top: MAX_ITEMS,
        });
        // 用 calendarView —— 它會把週期性事件(老闆的例休)展開成一筆一筆的實例。
        const response = await call(`${calendarUrl}/calendarView?${params.toString()}`);
        await assertOk(response, 'list Outlook calendar view');

        // 沒有處理 @odata.nextLink 事件太多時會被截斷
        const data = (await response.json()) as { value: GraphEvent[] };
        // showAs 是 free(空閒活動) 的不算佔用
        return data.value.filter((item) => item.showAs !== 'free').map(toPeriod);
      },

      // 用 /events 而不是 calendarView —— 只有這個端點會把擴充屬性 $expand 回來。
      // 代價是不展開週期性事件,但這支只用來找我們自己建立的預約,那些都不是週期性的
      async getEvents({ start, end, ownerId, limit }: EventQuery): Promise<Event[]> {
        // 半開區間的重疊條件,和 scheduling-tools 的 reserve 一致 ——
        // 只比對 start 的範圍會漏掉「開始在範圍之前、結束落在範圍內」的事件
        const conditions = [
          `start/dateTime lt '${toFilterTime(end)}'`,
          `end/dateTime gt '${toFilterTime(start)}'`,
        ];
        // ownerId 交給 Graph 過濾，$top 才會是「這位顧客的前 N 筆」
        if (ownerId) {
          conditions.push(
            `singleValueExtendedProperties/any(p:p/id eq '${OWNER_PROPERTY}' and p/value eq '${ownerId}')`,
          );
        }

        const params = new URLSearchParams({
          $filter: conditions.join(' and '),
          $select: SELECT,
          $expand: OWNER_EXPAND,
          $orderby: 'start/dateTime',
          $top: limit ? String(limit) : MAX_ITEMS,
        });

        const response = await call(`${calendarUrl}/events?${params.toString()}`);
        await assertOk(response, 'list Outlook events');

        const data = (await response.json()) as { value: GraphEvent[] };
        return data.value.map(toEvent);
      },

      async getEvent(eventId: string): Promise<Event | null> {
        const params = new URLSearchParams({ $select: SELECT, $expand: OWNER_EXPAND });

        const response = await call(`${eventUrl(eventId)}?${params.toString()}`);
        // 不存在與已刪除都是 404(Graph 沒有 Google 的 410)
        if (response.status === 404) return null;
        await assertOk(response, 'get Outlook event');

        const data = (await response.json()) as GraphEvent;
        return toEvent(data);
      },

      // Outlook 的「標籤」是帳號層級的類別,不屬於某一本日曆。
      // 它沒有可用的 id —— 事件上掛的是 displayName,所以 id 就用名稱
      async getLabels(): Promise<EventLabel[]> {
        const response = await call(`${GRAPH}/me/outlook/masterCategories`);
        await assertOk(response, 'list Outlook categories');

        const data = (await response.json()) as {
          value: { displayName: string; color?: string }[];
        };

        return data.value.map((item) => ({
          id: item.displayName,
          name: item.displayName,
          color: toPresetColor(item.color),
        }));
      },

      async createEvent(event: NewEvent): Promise<{ eventId: string }> {
        const response = await call(`${calendarUrl}/events`, {
          method: 'POST',
          body: JSON.stringify(toGraphEventBody(event)),
        });

        await assertOk(response, 'create Outlook event');

        const data = (await response.json()) as { id: string };
        return { eventId: data.id };
      },

      // Graph 的更新是 PATCH。我們送完整內容,所以效果等同整筆取代
      async updateEvent(eventId: string, event: NewEvent): Promise<void> {
        const response = await call(eventUrl(eventId), {
          method: 'PATCH',
          body: JSON.stringify(toGraphEventBody(event)),
        });

        await assertOk(response, 'update Outlook event');
      },

      async deleteEvent(eventId: string): Promise<void> {
        const response = await call(eventUrl(eventId), { method: 'DELETE' });

        await assertOk(response, 'cancel Outlook event');
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

// 建立與更新的 body 完全相同
function toGraphEventBody(event: NewEvent) {
  return {
    subject: event.summary,
    body: { contentType: 'text', content: event.description ?? '' },
    start: toGraphTime(event.start),
    end: toGraphTime(event.end),
    // 類別是用顯示名稱掛的,沒有 id
    categories: event.labelId ? [event.labelId] : [],
    singleValueExtendedProperties: [{ id: OWNER_PROPERTY, value: event.ownerId }],
  };
}

// Graph 的 dateTime 不帶 Z 也不帶位移,時區放在隔壁欄位
function toGraphTime(absolute: string) {
  return { dateTime: toFilterTime(absolute), timeZone: 'UTC' };
}

// $filter 裡的時間同樣不能帶 Z。基準時區由 Prefer: outlook.timezone="UTC" 決定
function toFilterTime(absolute: string): string {
  return absolute.replace(/Z$/, '');
}

// 反過來:Prefer header 讓回來的一律是 UTC,但 dateTime 沒有 Z,而且小數秒有七位,
// 所以補上 Z 之後讓 Date 正規化成專案通用的 ISO 格式
function toAbsolute(value: { dateTime: string }): string {
  return new Date(`${value.dateTime}Z`).toISOString();
}

function toPeriod(item: GraphEvent): TimePeriod {
  return { start: toAbsolute(item.start), end: toAbsolute(item.end) };
}

// 老闆在 Outlook 手動建立的事件沒有這個屬性,回 undefined —— 那正是 findOwnEvent 擋它的依據。
// Graph 回來的 id 會把 GUID 轉成小寫,所以比對要忽略大小寫
function readOwnerId(item: GraphEvent): string | undefined {
  const target = OWNER_PROPERTY.toLowerCase();

  return item.singleValueExtendedProperties?.find(
    (property) => property.id.toLowerCase() === target,
  )?.value;
}

function toEvent(item: GraphEvent): Event {
  return {
    eventId: item.id,
    summary: item.subject ?? '(無標題)',
    description: item.bodyPreview,
    ownerId: readOwnerId(item),
    ...toPeriod(item),
  };
}
