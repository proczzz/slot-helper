import { tool } from 'ai';
import { z } from 'zod';
import type { TelegramClient } from '../adapter/telegram/types.ts';

export function createSupportTools(telegramClient: TelegramClient, customerName: string | null) {
  return {
    notifyOwner: tool({
      description:
        '有需要時發送通知給管理員，例如顧客的需求或問題你無法處理、顧客有抱怨、或是發生需要本人知道的狀況',
      inputSchema: z.object({
        message: z.string().describe('要讓管理員知道的內容，說清楚發生什麼事以及顧客希望怎麼處理'),
      }),
      execute: async ({ message }) => {
        const who = customerName ? `顧客 ${customerName}` : '有顧客';

        try {
          await telegramClient.sendText(`${who}需要你處理\n\n${message}`);
        } catch (error) {
          // 不能丟錯 —— 會變成 tool-error,模型會連續重試
          console.error('通知管理員失敗:', error);
          return { notified: false, reason: '通知管理員失敗，請讓顧客改用電話聯絡' };
        }

        return { notified: true };
      },
    }),
  };
}
