import z from 'zod';

// 全部必填 —— 缺任何一個都代表還沒設定完,create 會回 null、功能關著。
// calendarId 要等授權完呼叫 /me/calendars 才拿得到,所以 DTO 那層允許它是空字串
export const OutlookSettingsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().min(1),
  calendarId: z.string().min(1),
});
