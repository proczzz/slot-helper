import { tool } from 'ai';
import { z } from 'zod';
import type { SchedulingProvider } from '../providers/scheduling/types.ts';
import { shopConfig } from './shop-config.ts';

const TimeRangeSchema = z.object({
  start: z.string().describe('開始時間,格式 YYYY-MM-DDTHH:mm,例如 2026-09-22T14:00'),
  end: z.string().describe('結束時間,格式 YYYY-MM-DDTHH:mm,例如 2026-09-22T16:00'),
});

// AI 給的是沒有時區的局部時間,補上店家時區偏移才是地球上確定的瞬間
function toAbsolute(localTime: string): string {
  return `${localTime}:00${shopConfig.utcOffset}`;
}

export function createSchedulingTools(schedulingProvider: SchedulingProvider) {
  return {
    checkAvailability: tool({
      description: '查詢指定時間範圍內,日曆上已經被佔用(不能預約)的時段',
      inputSchema: TimeRangeSchema,
      execute: async ({ start, end }) =>
        schedulingProvider.getBusyPeriods(toAbsolute(start), toAbsolute(end)),
    }),

    bookAppointment: tool({
      description: '在日曆上建立一筆新的預約',
      inputSchema: TimeRangeSchema.extend({
        summary: z.string().describe('預約標題,例如顧客姓名與服務項目'),
      }),
      execute: async ({ start, end, summary }) =>
        schedulingProvider.createBooking({
          summary,
          start: toAbsolute(start),
          end: toAbsolute(end),
        }),
    }),

    findAppointments: tool({
      description: '查詢指定時間範圍內的預約列表(含每筆預約的識別碼),用來找出要取消的那一筆',
      inputSchema: TimeRangeSchema,
      execute: async ({ start, end }) =>
        schedulingProvider.getEvents(toAbsolute(start), toAbsolute(end)),
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
