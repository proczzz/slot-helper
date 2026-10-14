import type { BotCommand, TelegramClient, WebhookInfo } from '../adapter/telegram/types.ts';
import { ExpectedError } from '../core/app-error.ts';
import type { ConfigRepository } from '../repository/types.ts';
import { loadTelegramConfig } from './config.ts';

// 會顯示在 Telegram 的「/」選單裡,註冊 webhook 時一併送給 Telegram
const COMMANDS: BotCommand[] = [{ command: 'reset', description: '重設後台登入密碼' }];

const NOT_CONFIGURED = 'Telegram 尚未設定，請先儲存設定';

export interface TelegramService {
  sendTest(): Promise<void>;
  webhookInfo(): Promise<WebhookInfo | null>;
  registerWebhook(url: string): Promise<WebhookInfo>;
}

export function createTelegramService(
  configRepository: ConfigRepository, // repository
  telegramClient: TelegramClient | null, // service
): TelegramService {
  return {
    async sendTest() {
      if (!telegramClient) throw new ExpectedError(NOT_CONFIGURED);

      // 這支的用途就是診斷,把 Telegram 的錯誤原文交給老闆
      try {
        await telegramClient.sendText('SlotHelper 測試訊息\n\n恭喜你成功接通 Telegram !! 🥳🥳');
      } catch (error) {
        throw new ExpectedError(error instanceof Error ? error.message : '發送失敗');
      }
    },

    async webhookInfo() {
      if (!telegramClient) return null;
      return telegramClient.getWebhookInfo();
    },

    async registerWebhook(url) {
      const config = await loadTelegramConfig(configRepository);
      if (!telegramClient || !config) throw new ExpectedError(NOT_CONFIGURED);

      // 純機器對機器的驗證碼,老闆不需要看到也不需要輸入,每次註冊都換新的
      const webhookSecret = crypto.randomUUID();

      // 先向 Telegram 註冊、成功才寫回設定。
      // 反過來的話註冊失敗就會留下一個 Telegram 不知道的驗證碼,原本還能用的 webhook 會跟著壞掉
      try {
        await telegramClient.setWebhook(url, webhookSecret);
      } catch (error) {
        throw new ExpectedError(error instanceof Error ? error.message : '註冊失敗');
      }
      await configRepository.set('telegram', JSON.stringify({ ...config, webhookSecret }));

      // 指令清單只影響「/」選單,失敗不該讓整個註冊算失敗
      await telegramClient.setCommands(COMMANDS).catch((error) => {
        console.error('設定 Telegram 指令清單失敗:', error);
      });

      return telegramClient.getWebhookInfo();
    },
  };
}
