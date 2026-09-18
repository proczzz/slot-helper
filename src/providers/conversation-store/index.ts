import type { ConversationStore, ConversationStoreEnv } from './types.ts';
import { sqliteConversationStore } from './sqlite.ts';

export function createConversationStore(env: ConversationStoreEnv): ConversationStore | null {
  if (!env.CONVERSATION_STORE || env.CONVERSATION_STORE === 'none') {
    return null;
  }
  if (env.CONVERSATION_STORE === 'sqlite') {
    return sqliteConversationStore;
  }
  throw new Error(`Unsupported CONVERSATION_STORE: "${env.CONVERSATION_STORE}"`);
}
