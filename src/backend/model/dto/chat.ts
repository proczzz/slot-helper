import { z } from 'zod';

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1, '請輸入測試身分'),
  message: z.string().min(1, '請輸入訊息'),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatResponse {
  reply: string;
}

export const TestCustomerSchema = z.object({
  id: z
    .string()
    .min(1, '請輸入識別碼')
    .regex(/^[A-Za-z0-9_-]+$/, '識別碼只能用英文、數字、底線與連字號'),
  name: z.string().min(1, '請輸入名稱'),
});

export type TestCustomerRequest = z.infer<typeof TestCustomerSchema>;
