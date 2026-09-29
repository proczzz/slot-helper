import { z } from 'zod';

export const SchedulingConfigSchema = z.object({
  provider: z.string(),
  google: z.object({
    serviceAccountEmail: z.string().min(1, '請輸入 Service Account 電子郵件'),
    privateKey: z.string().min(1, '請輸入私鑰'),
    calendars: z
      .array(
        z.object({
          id: z.string().min(1, '請輸入日曆 ID'),
          name: z.string().min(1, '請輸入日曆名稱'),
        }),
      )
      .min(1, '至少需要一本日曆'),
  }),
});

export type SchedulingConfig = z.infer<typeof SchedulingConfigSchema>;

export interface TimePeriod {
  start: string;
  end: string;
}

// 從日曆拿到的
export interface Event extends TimePeriod {
  eventId: string;
  summary: string;
  description?: string;
}

// 準備寫入日曆的
export interface Booking extends TimePeriod {
  summary: string;
  description?: string;
}

export interface SchedulingProvider {
  getBusyPeriods(range: TimePeriod): Promise<TimePeriod[]>;
  getEvents(range: TimePeriod): Promise<Event[]>;
  getEvent(eventId: string): Promise<Event>;
  createBooking(booking: Booking): Promise<{ eventId: string }>;
  cancelBooking(eventId: string): Promise<void>;
}

export interface SchedulingProviderConfig {
  SCHEDULING_PROVIDER?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_CALENDAR_ID?: string;
}
