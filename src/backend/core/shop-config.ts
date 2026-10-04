import { z } from 'zod';

const PeriodSchema = z.tuple([z.string(), z.string()]);

export const ShopConfigSchema = z.object({
  instructions: z.string().default(''),
  businessHours: z
    .object({
      mon: z.array(PeriodSchema).default([]),
      tue: z.array(PeriodSchema).default([]),
      wed: z.array(PeriodSchema).default([]),
      thu: z.array(PeriodSchema).default([]),
      fri: z.array(PeriodSchema).default([]),
      sat: z.array(PeriodSchema).default([]),
      sun: z.array(PeriodSchema).default([]),
    })
    .prefault({}),
  services: z
    .array(
      z.object({
        name: z.string().min(1, '請輸入服務名稱'),
        minutes: z.number().int().positive('所需時間必須大於 0'),
        price: z.number().int().nonnegative('價格不能是負數'),
        labelId: z.string().default(''),
      }),
    )
    .default([]),
});

export type ShopConfig = z.infer<typeof ShopConfigSchema>;
export type BusinessHours = ShopConfig['businessHours'];
export type DayKey = keyof BusinessHours;
export type Service = ShopConfig['services'][number];
