import { z } from 'zod';

export const TelegramConfigSchema = z.object({
  botToken: z.string().min(1, '請輸入 Bot token'),
  // 私聊的 chat ID 就是使用者 ID,群組是負數,所以允許開頭的減號
  chatId: z.string().regex(/^-?\d+$/, 'Chat ID 必須是數字'),
});

export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

export interface TelegramClient {
  sendText(text: string): Promise<void>;
}
