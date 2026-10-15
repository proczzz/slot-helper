import z from 'zod';
import type { ConfigMapper } from './types.ts';

const GoogleCalendarStoredSchema = z
  .object({
    serviceAccountEmail: z.string().default(''),
    privateKey: z.string().default(''),
    calendarId: z.string().default(''),
  })
  .prefault({});

const GoogleCalendarConfigReqSchema = z.object({
  serviceAccountEmail: z.string().optional(),
  privateKey: z.string().optional(),
  calendarId: z.string().optional(),
});

export const googleCalendarConfigMapper: ConfigMapper = {
  toConfig(body, stored) {
    const input = GoogleCalendarConfigReqSchema.parse(body);
    const previous = GoogleCalendarStoredSchema.parse(stored ?? undefined);

    return { ...previous, ...input };
  },

  toVo(stored) {
    if (stored === null) return null;

    const settings = GoogleCalendarStoredSchema.parse(stored);
    return {
      serviceAccountEmail: settings.serviceAccountEmail,
      hasPrivateKey: settings.privateKey.length > 0,
      calendarId: settings.calendarId,
    };
  },
};
