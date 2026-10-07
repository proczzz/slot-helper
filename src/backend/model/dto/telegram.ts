import { z } from 'zod';

export const WebhookSchema = z.object({
  url: z.string().min(1, '請輸入 Webhook 網址'),
});
