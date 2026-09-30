import { z } from 'zod';

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

// 每個供應商自己帶著名稱,並自行解析它需要的設定;設定不合就回 null
export interface SchedulingProviderDefinition {
  name: string;
  create(settings: unknown): SchedulingProvider | null;
}

// settings 的形狀由各供應商自己決定,中央不介入
export const SchedulingConfigSchema = z.object({
  provider: z.string(),
  settings: z.unknown(),
});

export type SchedulingConfig = z.infer<typeof SchedulingConfigSchema>;
