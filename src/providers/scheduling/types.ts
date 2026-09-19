export interface TimePeriod {
  start: string;
  end: string;
}

export interface Event {
  eventId: string;
  summary: string;
  start: string;
  end: string;
}

export interface Booking {
  summary: string;
  start: string;
  end: string;
  description?: string;
}

export interface SchedulingProvider {
  getBusyPeriods(start: string, end: string): Promise<TimePeriod[]>;
  getEvents(start: string, end: string): Promise<Event[]>;
  createBooking(booking: Booking): Promise<{ eventId: string }>;
  cancelBooking(eventId: string): Promise<void>;
}

export interface SchedulingProviderEnv {
  SCHEDULING_PROVIDER?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_CALENDAR_ID?: string;
}
