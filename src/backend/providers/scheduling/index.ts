import { createGoogleCalendarProvider } from './google-calendar.ts';
import type { SchedulingConfig, SchedulingProvider } from './types.ts';

type ProviderFactory = (config: SchedulingConfig) => SchedulingProvider | null;

const providers: Partial<Record<string, ProviderFactory>> = {
  'google-calendar': createGoogleProvider,
};

export function createSchedulingProvider(
  config: SchedulingConfig | null,
): SchedulingProvider | null {
  if (!config) return null;

  const factory = providers[config.provider];
  if (!factory) return null;

  return factory(config);
}

// 目前只用第一本日曆，多本之後再做
function createGoogleProvider(config: SchedulingConfig): SchedulingProvider | null {
  const calendar = config.google.calendars[0];
  if (!calendar) return null;

  return createGoogleCalendarProvider({
    clientEmail: config.google.serviceAccountEmail,
    privateKey: config.google.privateKey.replace(/\\n/g, '\n'),
    calendarId: calendar.id,
  });
}
