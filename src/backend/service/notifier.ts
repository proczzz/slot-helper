import type { TelegramClient } from '../adapter/telegram/types.ts';

export interface Notifier {
  enabled: boolean;
  login(details: { success: boolean; ip: string }): Promise<void>;
  systemError(where: string, error: unknown): Promise<void>;
  reportAgentIssue(message: string): Promise<void>;
  aiDemoted(name: string, reason: string, remaining: number): Promise<void>;
  customerPaused(customer: string, minutes: number): Promise<void>;
  toolInterrupted(tools: string[], reason: string): Promise<void>;
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
      return send(`${success ? '💡 後台登入成功' : '🚨 後台登入失敗'}\n來源 IP: ${ip}`);
    },

    systemError(where, error) {
      // Error 物件直接 stringify 會變成 {}
      const detail = error instanceof Error ? error.message : String(error);
      return send(`⚠️ 系統發生錯誤\n\n位置: ${where}\n\n訊息: ${detail}`);
    },
    reportAgentIssue(message) {
      return send(`🤖: ${message}`);
    },
    aiDemoted(name, reason, remaining) {
      const tail =
        remaining > 0 ? `還有 ${remaining} 組可用` : '⚠️ 已經沒有可用的金鑰，顧客只會收到保底訊息';
      return send(`🔑 AI 金鑰「${name}」已停用\n\n原因: ${reason}\n\n${tail}`);
    },
    customerPaused(customer, minutes) {
      return send(
        `⏸️ 顧客 ${customer} 對話過於頻繁，已暫停 AI ${minutes} 分鐘\n可以到後台提前恢復`,
      );
    },
    toolInterrupted(tools, reason) {
      return send(
        `🚨 AI 中斷，但已經動過資料\n\n已執行: ${tools.join('、')}\n\n原因: ${reason}\n\n` +
          `顧客收到保底訊息，請檢查操作到一半的工具`,
      );
    },
  };
}
