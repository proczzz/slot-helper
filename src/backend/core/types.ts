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

// 對話記憶-資料庫
export interface ConversationRepository {
  getMessages(sessionId: string, limit: number): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}

// 設定-資料庫
export interface ConfigRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setMany(entries: { key: string; value: string }[]): Promise<void>;
}

// <星期, 時段['HH:mm','HH:mm'][]>
export type BusinessHours = Record<string, [string, string][]>;

export interface ShopSettings {
  instructions: string;
  businessHours: BusinessHours;
}
