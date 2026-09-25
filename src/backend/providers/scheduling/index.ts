import { createGoogleCalendarProvider } from './google-calendar.ts';
import type { SchedulingProvider, SchedulingProviderEnv } from './types.ts';

function createGoogleProvider(env: SchedulingProviderEnv): SchedulingProvider | null {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID } = env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
    return null;
  }
  return createGoogleCalendarProvider({
    clientEmail: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    calendarId: GOOGLE_CALENDAR_ID,
  });
}

type ProviderFactory = (env: SchedulingProviderEnv) => SchedulingProvider | null;

const providers: Partial<Record<string, ProviderFactory>> = {
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
