import { z } from 'zod';

export const WhatsappConfigSchema = z.object({
  phoneNumberId: z.string().min(1, '請輸入 Phone number ID'),
  accessToken: z.string().min(1, '請輸入存取權杖'),
  appSecret: z.string().min(1, '請輸入 App secret'),
  // Meta 設定 webhook 時會把這個字串原樣送回來比對,由老闆自訂
  verifyToken: z.string().min(1, '請輸入驗證字串'),
});

export type WhatsappConfig = z.infer<typeof WhatsappConfigSchema>;

export interface WhatsappClient {
  verifyToken(token: string): boolean;
  verifySignature(body: string, signature: string): Promise<boolean>;
  sendText(to: string, text: string): Promise<void>;
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
