import { z } from 'zod';

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1, '請輸入測試身分'),
  message: z.string().min(1, '請輸入訊息'),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatResponse {
  reply: string;
}
