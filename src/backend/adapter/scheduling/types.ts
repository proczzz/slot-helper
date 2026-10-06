import { z } from 'zod';

export interface TimePeriod {
  start: string;
  end: string;
}

// 準備寫入日曆的
export interface NewEvent extends TimePeriod {
  summary: string;
  description?: string;
  labelId?: string;
  ownerId: string;
}

// 已存在日曆的
export interface Event extends TimePeriod {
  eventId: string;
  summary: string;
  description?: string;
  ownerId?: string; // 老闆在日曆手動新增的活動不會有
}

// ownerId 是精確比對,各供應商自行決定存在哪裡
export interface EventQuery {
  start: string;
  end?: string;
  ownerId?: string;
  limit?: number;
}

// 事件的標籤
export interface EventLabel {
  id: string;
  name: string;
  color: string;
}

export interface SchedulingProvider {
  getBusyPeriods(range: TimePeriod): Promise<TimePeriod[]>;
  getEvents(criteria: EventQuery): Promise<Event[]>;
  getEvent(eventId: string): Promise<Event | null>;
  getLabels(): Promise<EventLabel[]>;
  createEvent(event: NewEvent): Promise<{ eventId: string }>;
  updateEvent(eventId: string, event: NewEvent): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
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
