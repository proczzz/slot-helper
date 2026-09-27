import type { Message } from '../core/model/message';
import type { User } from '../core/model/user';

export interface ConversationRepository {
  getMessages(sessionId: string, limit: number): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}

export interface ConfigRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setMany(entries: { key: string; value: string }[]): Promise<void>;
}

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  insert(user: User): Promise<void>;
}
