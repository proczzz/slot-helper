import { z } from 'zod';
import { MessagingConfigSchema, type MessagingClient } from '../types';

export const WhatsappConfigSchema = MessagingConfigSchema.extend({
  phoneNumberId: z.string().min(1, '請輸入 Phone number ID'),
  // Meta 設定 webhook 時會把這個字串原樣送回來比對,由老闆自訂
  challengeToken: z.string().min(1, '請輸入驗證字串'),
});
export type WhatsappConfig = z.infer<typeof WhatsappConfigSchema>;

export interface WhatsappClient extends MessagingClient {
  verifyToken(token: string): boolean;
}

// webhook 的通知,只宣告我們會讀的欄位。參考:
// https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/
// 同一包 payload 會混入 statuses(已送達、已讀),那些沒有 messages,所以每層都是可選的
export interface WhatsappWebhookBody {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: WhatsappMessage[];
      };
    }[];
  }[];
}

export interface WhatsappMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
}
