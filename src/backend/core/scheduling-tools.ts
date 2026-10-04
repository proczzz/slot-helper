import { tool } from 'ai';
import { z } from 'zod';
import type { SchedulingProvider, TimePeriod } from '../adapter/scheduling/types.ts';
import { timeConfig } from './locale.ts';
import type { Service } from './shop-config.ts';

const MAX_APPOINTMENTS = 20;

const LocalTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '格式必須是 YYYY-MM-DDTHH:mm');

const TimeRangeSchema = z.object({
  start: LocalTimeSchema.describe('開始時間，格式 YYYY-MM-DDTHH:mm，例如 2026-09-22T14:00'),
  end: LocalTimeSchema.describe('結束時間，格式 YYYY-MM-DDTHH:mm，例如 2026-09-22T16:00'),
});

export function createSchedulingTools(
  schedulingProvider: SchedulingProvider,
  customerId: string,
  services: Service[],
) {
  // 取消與改期都必須確認這筆預約屬於當前顧客
  async function requireOwnEvent(eventId: string) {
    const event = await schedulingProvider.getEvent(eventId);
    if (customerId && event.description !== customerId) {
      throw new Error('這筆預約不屬於這位顧客');
    }
    return event;
  }
  // AI 可能填不在清單裡的名稱,查不到就不上色
  function labelIdOf(service: string): string | undefined {
    return services.find((s) => s.name === service)?.labelId || undefined;
  }

  return {
    checkAvailability: tool({
      description: '查詢指定時間範圍內，日曆上已經被佔用(不能預約)的時段',
      inputSchema: TimeRangeSchema,
      execute: async (range) => schedulingProvider.getBusyPeriods(toAbsoluteRange(range)),
    }),

    bookAppointment: tool({
      description: '在日曆上建立一筆新的預約',
      inputSchema: TimeRangeSchema.extend({
        summary: z.string().describe('預約標題，例如顧客姓名與服務項目'),
        service: z.string().describe('服務項目名稱，必須與服務清單中的名稱完全相同'),
      }),
      execute: async ({ summary, service, ...range }) =>
        schedulingProvider.createEvent({
          summary,
          description: customerId,
          labelId: labelIdOf(service),
          ...toAbsoluteRange(range),
        }),
    }),

    findMyAppointments: tool({
      description:
        '查詢這位顧客目前所有尚未開始的預約(含每筆的識別碼)。要取消或改期時先用這個找出正確的預約',
      inputSchema: z.object({}),
      execute: async () => {
        const events = await schedulingProvider.getEvents({
          start: new Date().toISOString(),
          keyword: customerId,
          limit: MAX_APPOINTMENTS,
        });

        // 沒有顧客身分時(例如 /api/chat)不過濾，維持原本行為
        if (!customerId) return events;
        return events.filter((event) => event.description === customerId);
      },
    }),

    rescheduleAppointment: tool({
      description:
        '更改一筆既有預約的時間，也可以同時更改服務項目。呼叫前先用 findMyAppointments 取得識別碼',
      inputSchema: TimeRangeSchema.extend({
        eventId: z.string().describe('要更改的預約識別碼'),
        summary: z.string().optional().describe('新的預約標題，不更改時可以省略'),
        service: z.string().describe('服務項目名稱，必須與服務清單中的名稱完全相同'),
      }),
      execute: async ({ eventId, summary, service, ...range }) => {
        const event = await requireOwnEvent(eventId);

        await schedulingProvider.updateEvent(eventId, {
          summary: summary ?? event.summary,
          description: event.description,
          labelId: labelIdOf(service),
          ...toAbsoluteRange(range),
        });
        return { success: true };
      },
    }),

    cancelAppointment: tool({
      description:
        '取消一筆預約。呼叫前先用 findMyAppointments 取得識別碼，並跟顧客確認要取消的是哪一筆',
      inputSchema: z.object({
        eventId: z.string().describe('要取消的預約識別碼'),
      }),
      execute: async ({ eventId }) => {
        await requireOwnEvent(eventId);
        await schedulingProvider.deleteEvent(eventId);
        return { success: true };
      },
    }),
  };
}

// AI 給的是沒有時區的局部時間，補上店家時區偏移才是地球上確定的瞬間
function toAbsolute(localTime: string): string {
  return `${localTime}:00${timeConfig.utcOffset}`;
}

function toAbsoluteRange(range: { start: string; end: string }): TimePeriod {
  return { start: toAbsolute(range.start), end: toAbsolute(range.end) };
}
