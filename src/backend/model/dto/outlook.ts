import z from 'zod';
import type { ConfigMapper } from './types.ts';

const StoredSchema = z
  .object({
    clientId: z.string().default(''),
    clientSecret: z.string().default(''),
    calendarId: z.string().default(''),
  })
  .prefault({});

const RequestSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  calendarId: z.string().optional(),
});

export const OutlookAuthorizeSchema = z.object({
  redirectUri: z.string().min(1),
});

export const outlookConfigMapper: ConfigMapper = {
  toConfig(body, stored) {
    const input = RequestSchema.parse(body);
    const previous = StoredSchema.parse(stored ?? undefined);

    // 合併後不再用 BO schema 嚴格驗 —— calendarId 要等授權完才拿得到,
    // 嚴格驗會讓第一次儲存就被擋下
    return { ...previous, ...input };
  },

  toVo(stored) {
    if (stored === null) return null;

    const settings = StoredSchema.parse(stored);
    return {
      clientId: settings.clientId,
      clientSecretMask: settings.clientSecret ? `${settings.clientSecret.slice(0, 3)}****` : '',
      calendarId: settings.calendarId,
    };
  },
};
