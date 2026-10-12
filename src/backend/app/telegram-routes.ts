import { Hono } from 'hono';
import type { BotCommand, TelegramUpdate } from '../adapter/telegram/types.ts';
import { loadTelegramConfig } from './config.ts';
import { ADMIN_USERNAME } from './initialize.ts';
import type { AppVariables } from './services.ts';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const RESET_COMMAND = '/reset';

// 會顯示在 Telegram 的「/」選單裡,註冊 webhook 時一併送給 Telegram
export const TELEGRAM_COMMANDS: BotCommand[] = [
  { command: 'reset', description: '重設後台登入密碼' },
];

const telegramRoutes = new Hono<AppVariables>();

telegramRoutes.post('/webhook', async (c) => {
  const { telegramClient, configRepository, adminAuth } = c.var.services;
  // 沒設定 Telegram 時接口還是開著,但不做任何事
  if (!telegramClient) return c.text('Telegram is not configured', 404);

  // chatId 與 secret 都只有這裡要用,不值得把它們塞進 client 的介面
  const config = await loadTelegramConfig(configRepository);
  if (!config?.webhookSecret) return c.text('Telegram webhook is not configured', 404);

  // Step1. 驗證發送請求的人是 Telegram
  // (setWebhook 時給的 secret 會被原樣放在 header,不像 LINE 要自己算簽章)
  if (c.req.header(SECRET_HEADER) !== config.webhookSecret) {
    return c.text('Invalid secret token', 401);
  }

  // 只處理管理員的文字訊息。其餘一律忽略但仍回 200，否則 Telegram 會一直重送
  const { message } = (await c.req.json()) as TelegramUpdate;
  if (!message?.text || String(message.chat.id) !== config.chatId) return c.text('OK');

  // Step2. 處理訊息(非阻塞)
  if (message.text.trim() === RESET_COMMAND) {
    c.var.runInBackground(resetPassword());
  }

  // Step3. 回應給 Telegram 平台 (step2 還在其他線程執行)
  return c.text('OK');

  async function resetPassword() {
    const password = await adminAuth.resetPassword(ADMIN_USERNAME);
    if (!password) {
      await telegramClient!.sendText('找不到管理帳號，無法重設密碼。');
      return;
    }
    console.log('已透過 Telegram 重設管理密碼');

    await telegramClient!.sendText(
      `💡 後台登入資訊\n\n帳號：${ADMIN_USERNAME}\n新密碼：${password}\n\n` +
        '請登入後立刻修改密碼，並刪除這則訊息。',
    );
  }
});

export { telegramRoutes };
