import type { TelegramClient, TelegramConfig } from './types.ts';

const API_BASE = 'https://api.telegram.org';

export function createTelegramClient(config: TelegramConfig | null): TelegramClient | null {
  if (!config) return null; // 老闆沒要用 Telegram
  const { botToken, chatId } = config;

  return {
    // chatId 固定是老闆,所以不開放指定收件者
    async sendText(text: string) {
      const response = await fetch(`${API_BASE}/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });

      if (!response.ok) {
        throw new Error(`Telegram sendMessage failed: ${response.status} ${await response.text()}`);
      }
    },
  };
}
