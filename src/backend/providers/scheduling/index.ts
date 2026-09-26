import { createGoogleCalendarProvider } from './google-calendar.ts';
import type { SchedulingProvider, SchedulingProviderConfig } from './types.ts';

function createGoogleProvider(config: SchedulingProviderConfig): SchedulingProvider | null {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID } = config;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
    return null;
  }
  return createGoogleCalendarProvider({
    clientEmail: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    calendarId: GOOGLE_CALENDAR_ID,
  });
}

type ProviderFactory = (config: SchedulingProviderConfig) => SchedulingProvider | null;

const providers: Partial<Record<string, ProviderFactory>> = {
  'google-calendar': createGoogleProvider,
};

// 依 SCHEDULING_PROVIDER 決定要不要啟用、啟用哪個排程供應商;未設定或設為 none 時停用
export function createSchedulingProvider(
  config: SchedulingProviderConfig,
): SchedulingProvider | null {
  if (!config.SCHEDULING_PROVIDER || config.SCHEDULING_PROVIDER === 'none') {
    return null;
  }
  const factory = providers[config.SCHEDULING_PROVIDER];
  if (!factory) {
    throw new Error(`Unsupported SCHEDULING_PROVIDER: "${config.SCHEDULING_PROVIDER}"`);
  }
  return factory(config);
}
