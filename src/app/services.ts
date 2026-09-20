import { createLanguageModel, listLanguageModels } from '../ai/language-model/index.ts';
import type { ConversationStore } from '../core/types.ts';
import { createSchedulingProvider } from '../providers/scheduling/index.ts';
import type { SchedulingProvider } from '../providers/scheduling/types.ts';

// CloudflareBindings 和 process.env 都能直接傳進來
export interface AppEnv {
  AI_PROVIDER?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;

  CONVERSATION_STORE?: string; // 資料庫

  SCHEDULING_PROVIDER?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_CALENDAR_ID?: string;
}

// 平台只負責提供"自己支援的"store 實作
export type StoreFactories = Partial<Record<string, () => ConversationStore>>;

export interface Services {
  model: ReturnType<typeof createLanguageModel>;
  listModels: () => ReturnType<typeof listLanguageModels>;
  conversationStore: ConversationStore | null;
  schedulingProvider: SchedulingProvider | null;
}

function resolveConversationStore(setting: string | undefined, factories: StoreFactories) {
  if (!setting || setting === 'none') return null;
  const factory = factories[setting];
  if (!factory) throw new Error(`此平台不支援 CONVERSATION_STORE="${setting}"`);
  return factory();
}

export function createServices(env: AppEnv, stores: StoreFactories): Services {
  return {
    model: createLanguageModel(env),
    listModels: () => listLanguageModels(env),
    conversationStore: resolveConversationStore(env.CONVERSATION_STORE, stores),
    schedulingProvider: createSchedulingProvider(env),
  };
}
