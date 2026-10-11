import type { TelegramClient } from '../adapter/telegram/types.ts';

export interface Notifier {
  enabled: boolean;
  login(details: { success: boolean; ip: string }): Promise<void>;
  systemError(where: string, error: unknown): Promise<void>;
}

const MAX_LENGTH = 3000; // 最長通知字數限制
export function createNotifier(telegramClient: TelegramClient | null): Notifier {
  async function send(text: string): Promise<void> {
    if (!telegramClient) return;
    try {
      await telegramClient.sendText(
        text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…(已截斷)` : text,
      );
    } catch (error) {
      console.error('通知老闆失敗:', error);
    }
  }

  return {
    enabled: telegramClient !== null,

    login({ success, ip }) {
      return send(`${success ? '後台登入成功' : '後台登入失敗'}\n來源 IP: ${ip}`);
    },

    systemError(where, error) {
      // Error 物件直接 stringify 會變成 {}
      const detail = error instanceof Error ? error.message : String(error);
      return send(`⚠️系統發生錯誤\n\n位置: ${where}\n\n訊息: ${detail}`);
    },
  };
}
