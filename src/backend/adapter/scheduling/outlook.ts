import z from 'zod';
import { getAccessToken, OutlookOauthSchema, type OutlookOauthSettings } from './outlook-oauth.ts';
import type { TokenStore } from './types.ts';

// OAuth 設定加上日曆 ID。缺任何一個都代表還沒設定完,create 會回 null、功能關著
export const OutlookSettingsSchema = OutlookOauthSchema.extend({
  calendarId: z.string().min(1),
});

export interface OutlookCalendar {
  id: string;
  name: string;
  isDefault: boolean;
}

const CALENDARS_URL =
  'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar,canEdit&$top=50';

// 設定階段用的:老闆挑日曆之前還沒有 calendarId,所以這支不經過 provider。
// Outlook 的日曆 id 是不透明字串、介面上看不到,所以一定要列給他挑
export async function fetchOutlookCalendars(
  settings: OutlookOauthSettings,
  tokens: TokenStore,
): Promise<OutlookCalendar[]> {
  const accessToken = await getAccessToken(settings, tokens);
  if (!accessToken) return [];

  const response = await fetch(CALENDARS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = (await response.text()).replace(/\s+/g, ' ').trim();
    throw new Error(`Failed to list Outlook calendars: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    value: { id: string; name: string; isDefaultCalendar?: boolean; canEdit?: boolean }[];
  };

  // 我們要寫入事件,唯讀的日曆選了也沒用。undefined 當成可以,不要誤殺
  return data.value
    .filter((item) => item.canEdit !== false)
    .map((item) => ({
      id: item.id,
      name: item.name,
      isDefault: item.isDefaultCalendar === true,
    }));
}
