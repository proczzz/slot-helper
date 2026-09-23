import { z } from 'zod';

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  customerId: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatResponse {
  reply: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationStore {
  getMessages(sessionId: string, limit: number): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}
