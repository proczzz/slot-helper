import { z } from 'zod';

export const ChatReqSchema = z.object({
  sessionId: z.string().min(1, '請輸入測試身分'),
  message: z.string().min(1, '請輸入訊息'),
});

export const TestCustomerReqSchema = z.object({
  id: z
    .string()
    .min(1, '請輸入識別碼')
    .regex(/^[A-Za-z0-9_-]+$/, '識別碼只能用英文、數字、底線與連字號'),
  name: z.string().min(1, '請輸入名稱'),
});
