import type { MessagingClient } from '../adapter/types.ts';
import type { ConversationRepository, CustomerRepository } from '../repository/types.ts';
import type { ChatService } from './chat-service.ts';
import type { Notifier } from './notifications.ts';
import type { SystemConfig } from './system-config.ts';

export interface IncomingMessage {
  channel: string; // line, whatsapp
  customerId: string; // 已含前綴,例如 line:Uxxx
  name: string | null;
  pictureUrl: string | null; // WhatsApp 沒有頭像,永遠是 null
  text: string;
  replyTo: string; // LINE 是 replyToken、WhatsApp 是顧客號碼
}

export interface MessageService {
  handleMessage(client: MessagingClient, incoming: IncomingMessage): Promise<void>;
}

export function createMessageService(
  systemConfig: SystemConfig, // properties
  customerRepository: CustomerRepository, // repository
  conversationRepository: ConversationRepository, // repository
  chatService: ChatService | null, // service
  notifier: Notifier, // service
): MessageService | null {
  if (!chatService) return null; // 沒有可用的 AI

  return {
    async handleMessage(client, incoming) {
      const { channel, customerId, name, pictureUrl, text, replyTo } = incoming;

      try {
        // 老闆接手中:沉默，連訊息都不存
        const customer = await customerRepository.findById(customerId);
        if (customer?.aiPausedUntil && customer.aiPausedUntil > Date.now()) return;

        // 更新用戶資料
        await customerRepository.upsertProfile({ id: customerId, channel, name, pictureUrl });

        // 太頻繁就暫停他,這次也不回應
        if (await pauseIfTooFrequent(customerId, name)) return;

        // ai 處理訊息
        const result = await chatService.handleChat(customerId, name, text);

        // 更新用戶資料中的最後訊息時間
        await customerRepository.updateLastMessage(customerId, text, Date.now());

        // 回覆客戶訊息
        await client.reply(replyTo, result.reply || systemConfig.fallbackReply);
      } catch (error) {
        console.error(`處理 ${channel} 訊息失敗:`, error);
        await client.reply(replyTo, systemConfig.fallbackReply).catch((replyError) => {
          console.error(`${channel} 回覆失敗:`, replyError);
        });
      }
    },
  };

  // 回 true 代表這次不該交給 AI。關閉時連查詢都不發
  async function pauseIfTooFrequent(customerId: string, name: string | null): Promise<boolean> {
    const { limitPauseMinutes, limitTurns, limitWindowMinutes, limitNotify } = systemConfig;
    if (limitPauseMinutes === 0) return false; // 0 = 沒有自動停用AI功能

    const since = Date.now() - limitWindowMinutes * 60_000;
    if ((await conversationRepository.countUserMessages(customerId, since)) < limitTurns) {
      return false;
    }

    await customerRepository.pauseAi(customerId, Date.now() + limitPauseMinutes * 60_000);
    if (limitNotify) await notifier.customerPaused(name ?? customerId, limitPauseMinutes);

    return true;
  }
}
