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
