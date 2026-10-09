import type { Customer } from '../model/entity/customer.ts';
import type { Message } from '../model/entity/message.ts';
import type { User } from '../model/entity/user.ts';

// config 表中的 key
export type ConfigKey =
  'system' | 'ai' | 'shop' | 'line' | 'telegram' | 'whatsapp' | 'scheduling' | 'google-calendar';

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

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  list(limit: number, before?: number, channel?: string): Promise<Customer[]>;
  upsertProfile(customer: {
    id: string;
    channel: string;
    name: string | null;
    pictureUrl: string | null;
  }): Promise<void>;
  updateDisplayName(id: string, displayName: string | null): Promise<void>;
  updateLastMessage(id: string, message: string, timestamp: number): Promise<void>;
}

export interface ConversationRepository {
  getMessages(sessionId: string, limit: number): Promise<Message[]>;
  listMessages(sessionId: string, before: number | null, limit: number): Promise<Message[]>;
  appendMessages(sessionId: string, messages: Message[]): Promise<void>;
}
