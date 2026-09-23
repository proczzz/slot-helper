import { tool } from 'ai';
import { z } from 'zod';
import type { SchedulingProvider, TimePeriod } from '../providers/scheduling/types.ts';
import { shopConfig } from './shop-config.ts';

const LocalTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '格式必須是 YYYY-MM-DDTHH:mm');

const TimeRangeSchema = z.object({
  start: LocalTimeSchema.describe('開始時間,格式 YYYY-MM-DDTHH:mm,例如 2026-09-22T14:00'),
  end: LocalTimeSchema.describe('結束時間,格式 YYYY-MM-DDTHH:mm,例如 2026-09-22T16:00'),
});

// AI 給的是沒有時區的局部時間,補上店家時區偏移才是地球上確定的瞬間
function toAbsolute(localTime: string): string {
  return `${localTime}:00${shopConfig.utcOffset}`;
}

function toAbsoluteRange(range: { start: string; end: string }): TimePeriod {
  return { start: toAbsolute(range.start), end: toAbsolute(range.end) };
}

export function createSchedulingTools(schedulingProvider: SchedulingProvider, customerId?: string) {
  // 寫進日曆活動的 description，用來辨識預約屬於哪位顧客
  // createSchedulingTools 方法在請求後呼叫，所以 customerTag 不再請求之間共用
  const customerTag = customerId ? `LINE:${customerId}` : undefined;
  return {
    checkAvailability: tool({
      description: '查詢指定時間範圍內,日曆上已經被佔用(不能預約)的時段',
      inputSchema: TimeRangeSchema,
      execute: async (range) => schedulingProvider.getBusyPeriods(toAbsoluteRange(range)),
    }),

    bookAppointment: tool({
      description: '在日曆上建立一筆新的預約',
      inputSchema: TimeRangeSchema.extend({
        summary: z.string().describe('預約標題,例如顧客姓名與服務項目'),
      }),
      execute: async ({ summary, ...rang }) =>
        schedulingProvider.createBooking({
          summary,
          description: customerTag,
          ...toAbsoluteRange(rang),
        }),
    }),

    findAppointments: tool({
      description: '查詢指定時間範圍內的預約列表(含每筆預約的識別碼),用來找出要取消的那一筆',
      inputSchema: TimeRangeSchema,
      execute: async (rang) => schedulingProvider.getEvents(toAbsoluteRange(rang)),
    }),

    cancelAppointment: tool({
      description:
        '取消一筆預約。呼叫前務必先用 findAppointments 找到正確的 eventId,並跟顧客確認過要取消的是哪一筆',
      inputSchema: z.object({
        eventId: z.string().describe('要取消的預約識別碼,從 findAppointments 的查詢結果取得'),
      }),
      execute: async ({ eventId }) => {
        await schedulingProvider.cancelBooking(eventId);
        return { success: true };
      },
    }),
  };
}
