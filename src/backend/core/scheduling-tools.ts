import { tool } from 'ai';
import { z } from 'zod';
import type { Event, SchedulingProvider, TimePeriod } from '../adapter/scheduling/types.ts';
import { freeSlots } from './availability.ts';
import type { Service, ShopConfig } from './shop-config.ts';
import { toAbsoluteTime, toLocalTime } from './time.ts';

const MAX_APPOINTMENTS = 20;
// 一次最多查 31 天 —— 範圍再大,回傳的區間會多到塞爆對話
const MAX_RANGE_MS = 31 * 24 * 60 * 60_000;

const LocalTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '格式必須是 YYYY-MM-DDTHH:mm');

const StartSchema = LocalTimeSchema.describe(
  '開始時間，格式 YYYY-MM-DDTHH:mm，例如 2026-09-22T14:00',
);

const EndSchema = LocalTimeSchema.optional().describe(
  '結束時間。通常不用給 —— 省略時會依服務項目的所需時間自動算出。' +
    '只有顧客要求特殊時長時才指定，例如按摩想做 90 分鐘',
);

const SummarySchema = z.string().describe('預約標題，例如顧客姓名與服務項目');

const NoteSchema = z
  .string()
  .optional()
  .describe('顧客提到的備註，例如「會帶小孩」。老闆在日曆上看得到，不更改時可以省略');

// resolveSlot 成功時的結果
interface Slot {
  range: TimePeriod;
  labelId?: string;
}

export function createSchedulingTools(
  schedulingProvider: SchedulingProvider,
  customerId: string,
  shopConfig: ShopConfig,
) {
  const { services, businessHours, timeZone } = shopConfig;
  const ServiceSchema = buildServiceSchema(services);
  const OptionalServiceSchema = ServiceSchema.optional().describe(
    '要查哪個服務的空檔。給了就只回放得下這個服務的時段，不給就回全部空檔',
  );

  // enum 已經擋住大部分情況,但服務清單為空時 schema 會退回 z.string(),所以還是要查
  function findService(name: string): Service | undefined {
    return services.find((service) => service.name === name);
  }

  // 把 AI 給的時間與服務項目解析成一個具體時段。回字串代表不能預約,內容是給 AI 看的原因
  function resolveSlot(start: string, end: string | undefined, service: string): Slot | string {
    const matched = findService(service);
    if (!matched) return '找不到這個服務項目，請老闆先在後台設定服務清單';

    const absoluteStart = toAbsoluteTime(start, timeZone);
    // end 沒給就用服務時長算。分鐘要加在絕對時間上 —— 加在局部時間上遇到日光節約換季會差一小時
    const absoluteEnd = end
      ? toAbsoluteTime(end, timeZone)
      : new Date(Date.parse(absoluteStart) + matched.minutes * 60_000).toISOString();

    if (Date.parse(absoluteEnd) <= Date.parse(absoluteStart)) {
      return '結束時間必須晚於開始時間';
    }

    return {
      range: { start: absoluteStart, end: absoluteEnd },
      labelId: matched.labelId || undefined,
    };
  }

  // 整個時段都落在營業時間內才算可以預約。busy 傳空的,因為「被佔用」要分開回報。
  // 呼叫前必須先擋掉過去的時間 —— freeSlots 會把過去截掉,否則這裡會誤報成「不在營業時間內」
  function isOpen(range: TimePeriod): boolean {
    const slots = freeSlots({ range, busy: [], businessHours, timeZone });
    return slots.length === 1 && slots[0]!.start === range.start && slots[0]!.end === range.end;
  }

  // AI 給的是沒有時區的局部時間,補上店家時區才是地球上確定的瞬間
  function toAbsoluteRange(range: { start: string; end: string }): TimePeriod {
    return {
      start: toAbsoluteTime(range.start, timeZone),
      end: toAbsoluteTime(range.end, timeZone),
    };
  }

  // 回給 AI 的時間一律是局部時間,和它送進來的格式一致
  function toLocalRange(range: TimePeriod) {
    return {
      start: toLocalTime(range.start, timeZone),
      end: toLocalTime(range.end, timeZone),
    };
  }

  // 取消與改期都必須確認這筆預約屬於當前顧客。回字串代表不是,內容是給 AI 看的原因。
  // 老闆在日曆上手動建立的事件沒有 ownerId,一樣會被擋下
  async function findOwnEvent(eventId: string): Promise<Event | string> {
    const event = await schedulingProvider.getEvent(eventId);
    if (!event || event.ownerId !== customerId) {
      return '找不到這筆預約，請先用 findMyAppointments 確認識別碼';
    }
    return event;
  }

  return {
    checkAvailability: tool({
      description:
        '查詢一段範圍內「可以預約」的時段。只在顧客要挑時間時使用；顧客已指定時間就直接預約或改期',
      inputSchema: z.object({
        start: StartSchema,
        end: LocalTimeSchema.describe('結束時間，格式 YYYY-MM-DDTHH:mm，例如 2026-09-29T20:00'),
        service: OptionalServiceSchema,
      }),
      execute: async ({ start, end, service }) => {
        const matched = service ? findService(service) : undefined;
        if (service && !matched) {
          return { slots: [], reason: '找不到這個服務項目，請老闆先在後台設定服務清單' };
        }

        const range = toAbsoluteRange({ start, end });
        const length = Date.parse(range.end) - Date.parse(range.start);

        if (length <= 0) return { slots: [], reason: '結束時間必須晚於開始時間' };
        if (length > MAX_RANGE_MS) {
          return { slots: [], reason: '一次最多查 31 天，請縮小查詢範圍' };
        }

        const busy = await schedulingProvider.getBusyPeriods(range);
        const slots = freeSlots({
          range,
          busy,
          businessHours,
          timeZone,
          minutes: matched?.minutes,
        });

        if (slots.length === 0) {
          return { slots: [], reason: '這段期間沒有可以預約的時段' };
        }

        return { slots: slots.map(toLocalRange) };
      },
    }),

    bookAppointment: tool({
      description:
        '建立預約。時段被佔用會回報，不必先查空檔。結束時間省略時依服務項目的所需時間算出',
      inputSchema: z.object({
        start: StartSchema,
        end: EndSchema,
        service: ServiceSchema,
        summary: SummarySchema,
        note: NoteSchema,
      }),
      execute: async ({ start, end, service, summary, note }) => {
        const slot = resolveSlot(start, end, service);
        if (typeof slot === 'string') return { booked: false, reason: slot };

        if (Date.parse(slot.range.start) < Date.now()) {
          return { booked: false, reason: '不能預約已經過去的時間' };
        }

        if (!isOpen(slot.range)) {
          return { booked: false, reason: '這個時段不在營業時間內' };
        }

        if (!reserve(slot.range)) {
          return { booked: false, reason: '這個時段剛被其他顧客預約，請換一個時間' };
        }

        try {
          const busy = await schedulingProvider.getBusyPeriods(slot.range);
          if (busy.length > 0) {
            return { booked: false, reason: '這個時段已經被佔用，請換一個時間' };
          }

          const { eventId } = await schedulingProvider.createEvent({
            summary,
            description: note,
            ownerId: customerId,
            labelId: slot.labelId,
            ...slot.range,
          });

          return { booked: true, eventId, ...toLocalRange(slot.range) };
        } finally {
          release(slot.range);
        }
      },
    }),

    findMyAppointments: tool({
      description:
        '查詢這位顧客目前所有尚未開始的預約(含每筆的識別碼)。要取消或改期時先用這個找出正確的預約',
      inputSchema: z.object({}),
      execute: async () => {
        const events = await schedulingProvider.getEvents({
          start: new Date().toISOString(),
          ownerId: customerId,
          limit: MAX_APPOINTMENTS,
        });

        // ownerId 是內部識別碼,AI 沒有用途,不送出去
        return events.map((event) => ({
          eventId: event.eventId,
          summary: event.summary,
          note: event.description,
          start: toLocalTime(event.start, timeZone),
          end: toLocalTime(event.end, timeZone),
        }));
      },
    }),

    rescheduleAppointment: tool({
      description:
        '更改預約的時間或服務項目。時段被佔用會回報，不必先查空檔。' +
        '結束時間省略時依服務項目的所需時間算出。先用 findMyAppointments 取得識別碼',
      inputSchema: z.object({
        eventId: z.string().describe('要更改的預約識別碼'),
        start: StartSchema,
        end: EndSchema,
        service: ServiceSchema,
        summary: z.string().optional().describe('新的預約標題，不更改時可以省略'),
        note: NoteSchema,
      }),
      execute: async ({ eventId, start, end, service, summary, note }) => {
        const event = await findOwnEvent(eventId);
        if (typeof event === 'string') return { rescheduled: false, reason: event };

        const slot = resolveSlot(start, end, service);
        if (typeof slot === 'string') return { rescheduled: false, reason: slot };

        if (Date.parse(slot.range.start) < Date.now()) {
          return { rescheduled: false, reason: '不能改到已經過去的時間' };
        }

        if (!isOpen(slot.range)) {
          return { rescheduled: false, reason: '這個時段不在營業時間內' };
        }

        if (!reserve(slot.range)) {
          return { rescheduled: false, reason: '這個時段剛被其他顧客預約，請換一個時間' };
        }

        try {
          // 用 getEvents 而不是 getBusyPeriods,因為要把「自己這筆」排除掉
          const overlapping = await schedulingProvider.getEvents(slot.range);
          if (overlapping.some((other) => other.eventId !== eventId)) {
            return { rescheduled: false, reason: '這個時段已經被佔用，請換一個時間' };
          }

          await schedulingProvider.updateEvent(eventId, {
            summary: summary ?? event.summary,
            description: note ?? event.description,
            ownerId: customerId,
            labelId: slot.labelId,
            ...slot.range,
          });

          return { rescheduled: true, ...toLocalRange(slot.range) };
        } finally {
          release(slot.range);
        }
      },
    }),

    cancelAppointment: tool({
      description:
        '取消一筆預約。呼叫前先用 findMyAppointments 取得識別碼，並跟顧客確認要取消的是哪一筆',
      inputSchema: z.object({
        eventId: z.string().describe('要取消的預約識別碼'),
      }),
      execute: async ({ eventId }) => {
        const found = await findOwnEvent(eventId);
        if (typeof found === 'string') return { cancelled: false, reason: found };

        await schedulingProvider.deleteEvent(eventId);
        return { cancelled: true };
      },
    }),
  };
}

// enum 讓模型在 function schema 裡直接看到可以填哪些服務,填別的會被 schema 擋下。
// z.enum 需要非空 tuple,所以還沒設定服務項目時退回 z.string(),由 execute 回報原因
function buildServiceSchema(services: Service[]): z.ZodType<string> {
  const names = services.map((service) => service.name);
  if (names.length === 0) return z.string().describe('服務項目名稱');

  return z.enum(names as [string, ...string[]]).describe('服務項目名稱，必須是服務清單裡的一個');
}

// Race Condition: 正在處理中的預約時段。
// 「檢查 + 加入」之間沒有 await，JS 單執行緒保證不會有兩個請求同時通過
const pending: TimePeriod[] = [];

function reserve(range: TimePeriod): boolean {
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);

  for (const other of pending) {
    // 我開始早於對方結束 且 對方開始早於我的結束 = 時間有衝突
    if (start < Date.parse(other.end) && Date.parse(other.start) < end) {
      return false;
    }
  }

  pending.push(range);
  return true;
}

function release(range: TimePeriod): void {
  const index = pending.indexOf(range);
  if (index !== -1) pending.splice(index, 1);
}
