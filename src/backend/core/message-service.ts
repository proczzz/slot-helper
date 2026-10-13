import type { MessagingClient } from '../adapter/types.ts';
import type { CustomerRepository } from '../repository/types.ts';
import type { ChatService } from './chat-service.ts';

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
  chatService: ChatService | null,
  customerRepository: CustomerRepository,
  fallbackReply: string,
): MessageService | null {
  if (!chatService) return null; // 沒有可用的 AI

  return {
    async handleMessage(client, incoming) {
      const { channel, customerId, name, pictureUrl, text, replyTo } = incoming;

      try {
        // 更新用戶資料
        await customerRepository.upsertProfile({ id: customerId, channel, name, pictureUrl });

        // ai 處理訊息
        const result = await chatService.handleChat(customerId, name, text);

        // 更新用戶資料中的最後訊息時間
        await customerRepository.updateLastMessage(customerId, text, Date.now());

        // 回覆客戶訊息
        await client.reply(replyTo, result.reply || fallbackReply);
      } catch (error) {
        console.error(`處理 ${channel} 訊息失敗:`, error);
        await client.reply(replyTo, fallbackReply).catch((replyError) => {
          console.error(`${channel} 回覆失敗:`, replyError);
        });
      }
    },
  };
}
