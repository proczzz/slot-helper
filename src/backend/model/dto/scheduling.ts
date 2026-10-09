import { z } from 'zod';
import { SchedulingConfigSchema } from '../../adapter/scheduling/types.ts';
import type { ConfigMapper } from './types.ts';

const CalendarSchema = z.object({ id: z.string(), name: z.string() });

// 讀既有設定用的寬鬆形狀。停用日曆時這些欄位會是空的,所以不加 min(1);
// 真正的驗證在 google-calendar.ts 建立 client 時才做
const StoredSchema = z.object({
  provider: z.string(),
  settings: z
    .object({
      serviceAccountEmail: z.string().default(''),
      privateKey: z.string().default(''),
      calendars: z.array(CalendarSchema).default([]),
    })
    .prefault({}),
});

// 後台送來的設定。privateKey 只在老闆重新上傳金鑰檔時才會送
const SchedulingConfigRequestSchema = z.object({
  provider: z.string(),
  settings: z.object({
    serviceAccountEmail: z.string(),
    privateKey: z.string().min(1, '金鑰內容是空的').optional(),
    calendars: z.array(CalendarSchema),
  }),
});

// 第二家排程供應商出現時,這個 mapper 要和 SchedulingProviderDefinition 一起重新設計 ——
// 它現在認識 Google 的 settings 形狀,那是只有一家時的簡化
export const schedulingConfigMapper: ConfigMapper = {
  toConfig(body, stored) {
    const input = SchedulingConfigRequestSchema.parse(body);
    const previous = StoredSchema.safeParse(stored);

    // 沒送就沿用舊的 —— 整個 settings 物件覆蓋會把私鑰洗掉,所以這個欄位要單獨處理
    const privateKey =
      input.settings.privateKey ?? (previous.success ? previous.data.settings.privateKey : '');

    return SchedulingConfigSchema.parse({
      provider: input.provider,
      settings: { ...input.settings, privateKey },
    });
  },

  toVo(stored) {
    const parsed = StoredSchema.safeParse(stored);
    if (!parsed.success) return null;

    const { provider, settings } = parsed.data;
    // 私鑰不給前端，沒意義
    return {
      provider,
      settings: {
        serviceAccountEmail: settings.serviceAccountEmail,
        hasPrivateKey: settings.privateKey.length > 0,
        calendars: settings.calendars,
      },
    };
  },
};
