import type { TelegramClient } from '../adapter/telegram/types.ts';

// 登入成功或失敗通知
export async function notifyLogin(
  telegramClient: TelegramClient | null,
  details: { success: boolean; ip: string },
): Promise<void> {
  if (!telegramClient) return; // 還沒設定 Telegram

  const title = details.success ? '後台登入成功' : '後台登入失敗';
  await telegramClient.sendText(`${title}\n來源 IP: ${details.ip}`);
}

// 全域 error handler 發通知
export async function notifySystemError(
  telegramClient: TelegramClient | null,
  where: string,
  error: unknown,
): Promise<void> {
  if (!telegramClient) return;

  // Error 物件直接 stringify 會變成 {}
  const detail = error instanceof Error ? error.message : String(error);
  await telegramClient.sendText(`⚠️系統發生錯誤\n\n位置: ${where}\n\n訊息: ${detail}`);
}
