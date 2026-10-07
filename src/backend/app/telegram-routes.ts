import { Hono } from 'hono';
import type { TelegramUpdate } from '../adapter/telegram/types.ts';
import { loadTelegramConfig } from './config.ts';
import type { AppVariables } from './services.ts';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const RESET_COMMAND = '/reset';

const telegramRoutes = new Hono<AppVariables>();

telegramRoutes.post('/webhook', async (c) => {
  const { telegramClient, configRepository } = c.var.services;
  // 檢查: 如果沒有設定 Telegram 還是會開啟 /webhook 接口，但不會執行實際工作
  if (!telegramClient) return c.text('Telegram is not configured', 404);

  // chatId 與 secret 都只有這裡要用,不值得把它們塞進 client 的介面
  const config = await loadTelegramConfig(configRepository);
  if (!config?.webhookSecret) return c.text('Telegram webhook is not configured', 404);

  // Step1. 驗證發送請求的人是 Telegram
  // (setWebhook 時給的 secret 會被原樣放在 header,不像 LINE 要自己算簽章)
  if (c.req.header(SECRET_HEADER) !== config.webhookSecret) {
    return c.text('Invalid secret token', 401);
  }

  // Step2. 只理老闆說的文字訊息。其餘一律忽略但仍回 200,否則 Telegram 會一直重送
  const { message } = (await c.req.json()) as TelegramUpdate;
  if (!message?.text || String(message.chat.id) !== config.chatId) return c.text('OK');

  if (message.text.trim() === RESET_COMMAND) {
    await telegramClient.sendText('收到，密碼重設功能還在施工中。');
  }

  return c.text('OK');
});

export { telegramRoutes };
