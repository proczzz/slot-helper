import z from 'zod';

export const MessagingConfigSchema = z.object({
  accessToken: z.string().min(1, '請輸入 Access Token'),
  webhookSecret: z.string().min(1, '請輸入 Webhook Secret'),
});

export interface MessagingClient {
  verifyRequest(body: string, headers: Headers): Promise<boolean>;
  reply(replyTo: string, text: string): Promise<void>;
}
