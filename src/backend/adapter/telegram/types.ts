import { z } from 'zod';
import { MessagingConfigSchema } from '../types';

export const TelegramConfigSchema = MessagingConfigSchema.extend({
  // 私聊的 chat ID 就是使用者 ID，群組是負數，所以開頭允許減號
  chatId: z.string().regex(/^-?\d+$/, 'Chat ID 必須是數字'),
});
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

export interface WebhookInfo {
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage?: string;
  lastErrorAt?: string;
}

export interface BotCommand {
  command: string; // 不帶斜線
  description: string;
}

export interface TelegramClient {
  sendText(text: string): Promise<void>;
  setWebhook(url: string, secretToken: string): Promise<void>;
  setCommands(commands: BotCommand[]): Promise<void>;
  getWebhookInfo(): Promise<WebhookInfo>;
}

// Telegram 的更新通知,只宣告我們會讀的欄位
export interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}
