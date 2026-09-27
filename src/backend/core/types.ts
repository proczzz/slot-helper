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

// <星期, 時段['HH:mm','HH:mm'][]>
export type BusinessHours = Record<string, [string, string][]>;

export interface ShopSettings {
  instructions: string;
  businessHours: BusinessHours;
}
