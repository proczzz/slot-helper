import type { Message } from '../core/types.ts';

export interface ConversationRepository {
  getMessages(sessionId: string, limit: number): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}

export interface ConfigRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setMany(entries: { key: string; value: string }[]): Promise<void>;
}
