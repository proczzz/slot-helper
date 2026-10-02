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
  id: z.string().min(1, '請輸入識別碼'),
  name: z.string().min(1, '請輸入名稱'),
});

export type TestCustomerRequest = z.infer<typeof TestCustomerSchema>;
