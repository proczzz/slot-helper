import type {
  BotCommand,
  TelegramClient,
  TelegramUpdate,
  WebhookInfo,
} from '../adapter/telegram/types.ts';
import type { AdminAuth } from '../admin/auth.ts';
import { ExpectedError } from '../core/app-error.ts';
import type { ConfigRepository } from '../repository/types.ts';
import { loadTelegramConfig } from './config.ts';
import { ADMIN_USERNAME } from './initialize.ts';

// 會顯示在 Telegram 的「/」選單裡,註冊 webhook 時一併送給 Telegram
const COMMANDS: BotCommand[] = [{ command: 'reset', description: '重設後台登入密碼' }];

const NOT_CONFIGURED = 'Telegram 尚未設定，請先儲存設定';

export interface TelegramService {
  sendTest(): Promise<void>;
  webhookInfo(): Promise<WebhookInfo | null>;
  registerWebhook(url: string): Promise<WebhookInfo>;
  verifyRequest(headers: Headers): Promise<boolean>;
  handleUpdate(update: TelegramUpdate): Promise<void>;
}

// setWebhook 時給的 secret 會被原樣放在這個 header,不像 LINE 要自己算簽章
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const RESET_COMMAND = '/reset';

export function createTelegramService(
  configRepository: ConfigRepository, // repository
  telegramClient: TelegramClient | null, // service
  adminAuth: AdminAuth, // service
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
    async verifyRequest(headers) {
      const config = await loadTelegramConfig(configRepository);
      if (!config?.webhookSecret) return false; // 還沒註冊過 webhook

      return headers.get(SECRET_HEADER) === config.webhookSecret;
    },

    async handleUpdate(update) {
      if (!telegramClient) return;

      const config = await loadTelegramConfig(configRepository);
      const { message } = update;
      // 只處理老闆本人的文字訊息
      if (!message?.text || String(message.chat.id) !== config?.chatId) return;
      if (message.text.trim() !== RESET_COMMAND) return;

      const password = await adminAuth.resetPassword(ADMIN_USERNAME);
      if (!password) {
        await telegramClient.sendText('找不到管理帳號，無法重設密碼。');
        return;
      }
      console.log('已透過 Telegram 重設管理密碼');

      await telegramClient.sendText(
        `💡 後台登入資訊\n\n帳號：${ADMIN_USERNAME}\n新密碼：${password}\n\n` +
          '請登入後立刻修改密碼，並刪除這則訊息。',
      );
    },
  };
}
