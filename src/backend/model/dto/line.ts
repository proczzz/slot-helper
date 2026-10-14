import { z } from 'zod';
import { LineConfigSchema } from '../../adapter/line/types.ts';
import type { ConfigMapper } from './types.ts';

// 可選欄位沒輸入時代表沿用舊設定
const LineConfigRequestSchema = z.object({
  accessToken: z.string().min(1, '請輸入 Channel access token').optional(),
  webhookSecret: z.string().min(1, '請輸入 Channel secret').optional(),
});

export const lineConfigMapper: ConfigMapper = {
  toConfig(body, stored) {
    const input = LineConfigRequestSchema.parse(body);
    const current = LineConfigSchema.partial().parse(stored ?? {});

    // 有送的覆蓋、沒送的保留。合併完再嚴格驗一次，首次設定沒填齊會在這裡被擋下
    return LineConfigSchema.parse({ ...current, ...input });
  },

  toVo(stored) {
    const parsed = LineConfigSchema.safeParse(stored);
    if (!parsed.success) return null; // 格式不符就當成未設定，不要讓設定頁整頁掛掉

    const { accessToken, webhookSecret } = parsed.data;
    return {
      accessTokenMask: `****${accessToken.slice(-4)}`,
      webhookSecretMask: `****${webhookSecret.slice(-4)}`,
    };
  },
};
