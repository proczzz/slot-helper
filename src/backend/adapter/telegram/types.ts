import { z } from 'zod';

export const TelegramConfigSchema = z.object({
  botToken: z.string().min(1, '請輸入 Bot token'),
  // 私聊的 chat ID 就是使用者 ID,群組是負數,所以允許開頭的減號
  chatId: z.string().regex(/^-?\d+$/, 'Chat ID 必須是數字'),
  // 驗證 webhook 請求真的來自 Telegram,空的代表還沒啟用 webhook
  webhookSecret: z.string().default(''),
});

export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

export interface WebhookInfo {
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage?: string;
  lastErrorAt?: string;
}

export interface TelegramClient {
  sendText(text: string): Promise<void>;
  setWebhook(url: string, secretToken: string): Promise<void>;
  getWebhookInfo(): Promise<WebhookInfo>;
}

// Telegram 的更新通知,只宣告我們會讀的欄位
export interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}
