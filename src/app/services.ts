import { createLanguageModel } from '../ai/language-model/index.ts';
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

// 只由環境變數字串建出來的服務,沒有綁定任何單一 request,可以跨 request 重用。
interface SharedProviders {
  model: ReturnType<typeof createLanguageModel>;
  schedulingProvider: SchedulingProvider | null;
}

// Node 上等同啟動時建一次;Cloudflare 上 warm isolate 內重用,cold start 就重算。
// 前提是單一部署只有一組環境變數;若將來支援多店家,這裡要改成依 config 分開快取,
// 否則不同店家會共用到同一份 Google token
let cachedProviders: SharedProviders | undefined;

function getSharedProviders(env: AppEnv): SharedProviders {
  if (cachedProviders) return cachedProviders;

  // 先建成功才寫入快取,失敗狀態不快取,讓下一個 request 重試
  cachedProviders = {
    model: createLanguageModel(env),
    schedulingProvider: createSchedulingProvider(env),
  };
  return cachedProviders;
}

export interface Services {
  model: ReturnType<typeof createLanguageModel>;
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
  const { model, schedulingProvider } = getSharedProviders(env);
  return {
    model,
    conversationStore: resolveConversationStore(env.CONVERSATION_STORE, stores),
    schedulingProvider,
  };
}
