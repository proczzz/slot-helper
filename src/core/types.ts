import { z } from 'zod';

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
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
  getMessages(sessionId: string): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}
