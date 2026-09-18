import type { Message } from '../../core/types.ts';

export interface ConversationStore {
  getMessages(sessionId: string): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}

export interface ConversationStoreEnv {
  CONVERSATION_STORE?: string;
}
