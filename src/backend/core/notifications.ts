import type { TelegramClient } from '../adapter/telegram/types.ts';

// 登入成功或失敗通知
export function notifyLogin(
  telegramClient: TelegramClient | null,
  details: { success: boolean; ip: string },
): Promise<void> {
  const title = details.success ? '後台登入成功' : '後台登入失敗';
  return send(telegramClient, `${title}\n來源 IP: ${details.ip}`);
}

// 全域 error handler 發通知
export function notifySystemError(
  telegramClient: TelegramClient | null,
  where: string,
  error: unknown,
): Promise<void> {
  // Error 物件直接 stringify 會變成 {}
  const detail = error instanceof Error ? error.message : String(error);
  return send(telegramClient, `⚠️系統發生錯誤\n\n位置: ${where}\n\n訊息: ${detail}`);
}

// 通知失敗只能記 log。再發一次通知就會繞回自己,所以這個函式永不 reject
async function send(telegramClient: TelegramClient | null, text: string): Promise<void> {
  if (!telegramClient) return; // 還沒設定 Telegram

  try {
    await telegramClient.sendText(text);
  } catch (error) {
    console.error('通知老闆失敗:', error);
  }
}
