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
