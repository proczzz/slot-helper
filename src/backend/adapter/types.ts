import z from 'zod';

export const MessagingConfigSchema = z.object({
  accessToken: z.string().min(1, '請輸入 Access Token'),
  webhookSecret: z.string().min(1, '請輸入 Webhook Secret'),
});

// 需要 mask 的兩欄
export const MESSAGING_SECRETS = ['accessToken', 'webhookSecret'];
