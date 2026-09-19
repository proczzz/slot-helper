import { createGoogleCalendarProvider } from './google-calendar.ts';
import type { SchedulingProvider, SchedulingProviderEnv } from './types.ts';

function createGoogleProvider(env: SchedulingProviderEnv): SchedulingProvider {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID } = env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_CALENDAR_ID are all required when SCHEDULING_PROVIDER=google-calendar',
    );
  }
  return createGoogleCalendarProvider({
    clientEmail: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    calendarId: GOOGLE_CALENDAR_ID,
  });
}

const providers: Record<string, (env: SchedulingProviderEnv) => SchedulingProvider> = {
  'google-calendar': createGoogleProvider,
};

// 依 SCHEDULING_PROVIDER 決定要不要啟用、啟用哪個排程供應商;未設定或設為 none 時停用
export function createSchedulingProvider(env: SchedulingProviderEnv): SchedulingProvider | null {
  if (!env.SCHEDULING_PROVIDER || env.SCHEDULING_PROVIDER === 'none') {
    return null;
  }
  const factory = providers[env.SCHEDULING_PROVIDER];
  if (!factory) {
    throw new Error(`Unsupported SCHEDULING_PROVIDER: "${env.SCHEDULING_PROVIDER}"`);
  }
  return factory(env);
}
