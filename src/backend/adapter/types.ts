import z from 'zod';

export const MessagingConfigSchema = z.object({
  accessToken: z.string().min(1, '請輸入 Access Token'),
  webhookSecret: z.string().min(1, '請輸入 Webhook Secret'),
});

export interface IncomingMessage {
  channel: string; // line, whatsapp
  customerId: string; // 已含前綴,例如 line:Uxxx
  name: string | null;
  pictureUrl: string | null; // WhatsApp 沒有頭像,永遠是 null
  text: string;
  replyTo: string; // LINE 是 replyToken、WhatsApp 是顧客號碼
}

export interface MessagingClient {
  verifyRequest(body: string, headers: Headers): Promise<boolean>;
  parseMessages(body: string): Promise<IncomingMessage[]>;
  reply(replyTo: string, text: string): Promise<void>;
}
