import type { BotCommand, TelegramClient, TelegramConfig, WebhookInfo } from './types.ts';

const API_BASE = 'https://api.telegram.org';

export function createTelegramClient(config: TelegramConfig | null): TelegramClient | null {
  if (!config) return null; // 老闆沒要用 Telegram
  const { accessToken, chatId } = config;

  // Telegram 把失敗原因寫在 description,比 HTTP 狀態碼有用得多,所以統一在這裡取出來
  async function call<T>(method: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}/bot${accessToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      throw new Error(`Telegram ${method} 失敗: ${data.description ?? response.status}`);
    }

    return data.result as T;
  }

  return {
    // chatId 固定是老闆,所以不開放指定收件者
    async sendText(text: string) {
      await call('sendMessage', { chat_id: chatId, text });
    },

    // allowed_updates 只留 message,其他類型(編輯訊息、按鈕回呼)我們沒有在處理
    async setWebhook(url: string, secretToken: string) {
      await call('setWebhook', { url, secret_token: secretToken, allowed_updates: ['message'] });
    },

    // 設定「/」選單裡顯示的指令清單。只是提示,不代表權限
    async setCommands(commands: BotCommand[]) {
      await call('setMyCommands', { commands });
    },

    async getWebhookInfo(): Promise<WebhookInfo> {
      const info = await call<{
        url: string;
        pending_update_count: number;
        last_error_message?: string;
        last_error_date?: number;
      }>('getWebhookInfo', {});

      return {
        url: info.url,
        pendingUpdateCount: info.pending_update_count,
        lastErrorMessage: info.last_error_message,
        // Telegram 給的是秒,全專案用 ISO 字串
        lastErrorAt: info.last_error_date
          ? new Date(info.last_error_date * 1000).toISOString()
          : undefined,
      };
    },
  };
}
