import { tool } from 'ai';
import { z } from 'zod';
import type { SchedulingProvider } from '../providers/scheduling/types.ts';

const DateRangeSchema = z.object({
  date: z.string().describe('要查詢的日期,格式 YYYY-MM-DD'),
  startTime: z.string().describe('查詢範圍的開始時間,格式 HH:mm'),
  endTime: z.string().describe('查詢範圍的結束時間,格式 HH:mm'),
});

// 把日期與時間組成帶時區的 ISO 8601 字串
function toTimeRange(date: string, startTime: string, endTime: string) {
  return {
    start: `${date}T${startTime}:00+08:00`,
    end: `${date}T${endTime}:00+08:00`,
  };
}

export function createSchedulingTools(schedulingProvider: SchedulingProvider) {
  return {
    checkAvailability: tool({
      description: '查詢指定日期時段內,日曆上已經被佔用(不能預約)的時段',
      inputSchema: DateRangeSchema,
      execute: async ({ date, startTime, endTime }) => {
        const { start, end } = toTimeRange(date, startTime, endTime);
        return schedulingProvider.getBusyPeriods(start, end);
      },
    }),

    bookAppointment: tool({
      description: '在日曆上建立一筆新的預約',
      inputSchema: DateRangeSchema.extend({
        summary: z.string().describe('預約標題,例如顧客姓名與服務項目'),
      }),
      execute: async ({ date, startTime, endTime, summary }) => {
        const { start, end } = toTimeRange(date, startTime, endTime);
        return schedulingProvider.createBooking({ summary, start, end });
      },
    }),

    findAppointments: tool({
      description: '查詢指定日期時段內的預約列表(含每筆預約的識別碼),用來找出要取消的那一筆',
      inputSchema: DateRangeSchema,
      execute: async ({ date, startTime, endTime }) => {
        const { start, end } = toTimeRange(date, startTime, endTime);
        return schedulingProvider.getEvents(start, end);
      },
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
