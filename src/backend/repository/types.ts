import type { Message } from '../core/model/message';
import type { User } from '../core/model/user';

export interface ConversationRepository {
  getMessages(sessionId: string, limit: number): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}

// config 表中的 key
export type ConfigKey = 'system' | 'ai' | 'shop' | 'line' | 'scheduling';

export interface ConfigRepository {
  get(key: ConfigKey): Promise<string | null>;
  set(key: ConfigKey, value: string): Promise<void>;
  setMany(entries: { key: ConfigKey; value: string }[]): Promise<void>;
  remove(key: ConfigKey): Promise<void>;
}

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>;
  insert(user: User): Promise<void>;
  updatePassword(username: string, password: string): Promise<void>;
}
