import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchAccountEmail,
  parseOutlookState,
  type OutlookState,
} from '../adapter/scheduling/outlook-oauth.ts';
import { fetchOutlookCalendars, type OutlookCalendar } from '../adapter/scheduling/outlook.ts';
import type { EventLabel, SchedulingProvider, TokenStore } from '../adapter/scheduling/types.ts';
import { ExpectedError } from '../core/app-error.ts';
import type { Properties } from './properties.ts';

export interface OutlookConnection {
  connected: boolean;
  accountEmail: string;
}

export interface CalendarService {
  labels(): Promise<EventLabel[]>;
  authorizeUrl(redirectUri: string, state: string): Promise<string>;
  completeAuthorization(redirectUri: string, code: string): Promise<void>;
  connection(): Promise<OutlookConnection>;
  disconnect(): Promise<void>;
  calendars(): Promise<OutlookCalendar[]>;
}

export function createCalendarService(
  properties: Properties, // properties
  tokens: TokenStore, // service
  schedulingProvider: SchedulingProvider | null, // service
): CalendarService {
  return {
    async labels() {
      if (!schedulingProvider) return []; // 還沒選日曆供應商
      return schedulingProvider.getLabels();
    },

    async authorizeUrl(redirectUri, state) {
      // 發起授權一定要有憑證,這和「列日曆」不同 —— 那個在還沒設定時空著是正常的
      if (!properties.outlook) throw new ExpectedError('請先儲存 Client ID 與用戶端密碼');

      return buildAuthorizeUrl(properties.outlook, redirectUri, state);
    },

    async completeAuthorization(redirectUri, code) {
      if (!properties.outlook) throw new ExpectedError('尚未設定 Client ID 與用戶端密碼');

      const issued = await exchangeCode(properties.outlook, redirectUri, code);
      const accountEmail = await fetchAccountEmail(issued.accessToken);

      const next: OutlookState = { refreshToken: issued.refreshToken, accountEmail };
      await tokens.set(JSON.stringify(next));
    },

    async connection() {
      const state = parseOutlookState(await tokens.get());

      return { connected: !!state, accountEmail: state?.accountEmail ?? '' };
    },

    disconnect() {
      return tokens.clear();
    },

    async calendars() {
      if (!properties.outlook) return []; // 還沒填憑證,下拉選單空著

      return fetchOutlookCalendars(properties.outlook, tokens);
    },
  };
}
