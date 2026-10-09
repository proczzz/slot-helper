import { z } from 'zod';
import { WhatsappConfigSchema } from '../../adapter/whatsapp/types.ts';
import type { ConfigMapper } from './types.ts';

// 可選欄位沒輸入時代表沿用舊設定
const WhatsappConfigRequestSchema = z.object({
  accessToken: z.string().min(1, '請輸入存取權杖').optional(),
  webhookSecret: z.string().min(1, '請輸入 App secret').optional(),
  phoneNumberId: z.string().min(1, '請輸入 Phone number ID'),
  challengeToken: z.string().min(1, '請輸入驗證字串'),
});

export const whatsappConfigMapper: ConfigMapper = {
  toConfig(body, stored) {
    const input = WhatsappConfigRequestSchema.parse(body);
    const current = WhatsappConfigSchema.partial().parse(stored ?? {});

    return WhatsappConfigSchema.parse({ ...current, ...input });
  },

  toVo(stored) {
    const parsed = WhatsappConfigSchema.safeParse(stored);
    if (!parsed.success) return null;

    const { accessToken, webhookSecret, phoneNumberId, challengeToken } = parsed.data;
    // challengeToken 不遮罩 —— 老闆要讀回來貼進 Meta 的表單
    return {
      accessTokenMask: `••••••${accessToken.slice(-4)}`,
      webhookSecretMask: `••••••${webhookSecret.slice(-4)}`,
      phoneNumberId,
      challengeToken,
    };
  },
};
