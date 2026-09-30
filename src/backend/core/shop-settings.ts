import { z } from 'zod';

export const ShopSettingsSchema = z.object({
  instructions: z.string(),
  businessHours: z.record(z.string(), z.array(z.tuple([z.string(), z.string()]))),
});

export type ShopSettings = z.infer<typeof ShopSettingsSchema>;
export type BusinessHours = ShopSettings['businessHours'];
