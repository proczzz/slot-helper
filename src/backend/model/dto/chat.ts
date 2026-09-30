import { z } from 'zod';

export const ChatRequestSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  customerId: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatResponse {
  reply: string;
}
