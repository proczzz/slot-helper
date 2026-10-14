import { z } from 'zod';
import type { ConfigMapper } from './types';
import { TelegramConfigSchema } from '../../adapter/telegram/types';

export const WebhookSchema = z.object({
  url: z.string().min(1, '請輸入 Webhook 網址'),
});

// 後台送來的設定。webhookSecret 不在這裡 —— 它是後端自己產生的,不該讓前端覆寫
const TelegramConfigRequestSchema = z.object({
  accessToken: z.string().min(1, '請輸入 Bot token').optional(),
  chatId: z.string().regex(/^-?\d+$/, 'Chat ID 必須是數字'),
});

export const telegramConfigMapper: ConfigMapper = {
  toConfig(body, stored) {
    const input = TelegramConfigRequestSchema.parse(body);
    const current = TelegramConfigSchema.partial().parse(stored ?? {});

    return TelegramConfigSchema.parse({ ...current, ...input });
  },

  toVo(stored) {
    const parsed = TelegramConfigSchema.safeParse(stored);
    if (!parsed.success) return null;

    const { accessToken, chatId } = parsed.data;
    // 通關密語不顯示
    return {
      accessTokenMask: `****${accessToken.slice(-4)}`,
      chatId,
    };
  },
};
