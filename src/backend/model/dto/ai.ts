import { z } from 'zod';
import { AiConfigSchema, AiUsageSchema } from '../../adapter/ai/types.ts';
import type { ConfigMapper } from './types.ts';

// 儲存AI配置請求 (apiKey 沒輸入時代表沿用舊設定)
const AiConfigReqSchema = z.object({
  name: z.string().min(1, '請輸入名稱'),
  provider: z.string().min(1, '請選擇供應商'),
  model: z.string().min(1, '請輸入模型名稱'),
  apiKey: z.string().min(1, '請輸入 API key').optional(),
  usage: AiUsageSchema,
});

// 列出可用AI模型請求 (沒送 apiKey 時用 name 去找已儲存的那把)
export const ListModelsReqSchema = z
  .object({
    provider: z.string().min(1, '請選擇供應商'),
    apiKey: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .refine((input) => input.apiKey ?? input.name, '請提供 API key 或名稱');

// 復原停用 aikey 請求
export const RestoreDemotionReqSchema = z.object({
  keyName: z.string().min(1, '請指定要解除的名稱'),
});

export const aiConfigMapper: ConfigMapper = {
  toConfig(body, stored) {
    const input = z.array(AiConfigReqSchema).parse(body);
    const parsed = AiConfigSchema.safeParse(stored);
    const current = parsed.success ? parsed.data : [];

    // 用 ai key name 對應回舊設定
    const merged = input.map((item) => ({
      ...item,
      apiKey: item.apiKey ?? current.find((key) => key.name === item.name)?.apiKey,
    }));

    // 合併完再嚴格驗一次,新增卻沒填 apiKey 會在這裡被擋下
    return AiConfigSchema.parse(merged);
  },

  toVo(stored) {
    const parsed = AiConfigSchema.safeParse(stored);
    if (!parsed.success) return []; // 格式不符就當成未設定,不要讓設定頁整頁掛掉

    return parsed.data.map(({ apiKey, ...rest }) => ({
      ...rest,
      apiKeyMask: `****${apiKey.slice(-4)}`,
    }));
  },
};
