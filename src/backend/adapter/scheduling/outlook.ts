import z from 'zod';
import { OutlookOauthSchema } from './outlook-oauth.ts';

// OAuth 設定加上日曆 ID。缺任何一個都代表還沒設定完,create 會回 null、功能關著
export const OutlookSettingsSchema = OutlookOauthSchema.extend({
  calendarId: z.string().min(1),
});
