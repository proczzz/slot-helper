import type { LanguageModel } from 'ai';
import { createLanguageModel } from '../ai/language-model/index.ts';
import type { LanguageModelEnv } from '../ai/language-model/types.ts';
import { createLineClient } from '../channels/line/line-client.ts';
import type { LineClient, LineEnv } from '../channels/line/types.ts';
import type { ConversationStore } from '../core/types.ts';
import { createSchedulingProvider } from '../providers/scheduling/index.ts';
import type { SchedulingProvider, SchedulingProviderEnv } from '../providers/scheduling/types.ts';
import { AdminEnv } from '../admin/types.ts';
import { AdminAuth, createAdminAuth } from '../admin/auth.ts';

// CloudflareBindings 和 process.env 都能直接傳進來
export interface AppEnv extends LanguageModelEnv, SchedulingProviderEnv, LineEnv, AdminEnv {}

// 平台只負責提供"自己支援的"store 實作
export type StoreFactories = Partial<Record<string, () => ConversationStore>>;

export interface Services {
  model: LanguageModel;
  conversationStore: ConversationStore;
  schedulingProvider: SchedulingProvider | null;
  lineClient: LineClient | null;
  adminAuth: AdminAuth | null;
}

export type AppVariables = {
  Variables: {
    services: Services;
    // line 需要即時回應 200，工作要放給另一個thread，而不同平台寫法不同
    // node 不 await 就好，cloudflare worker 回應後會殺
    runInBackground: (task: Promise<unknown>) => void;
  };
};

type SharedProviders = Omit<Services, 'conversationStore'>;

// 快取可抽換的 AI模型、預約工具
let cachedProviders: SharedProviders | undefined;

function getSharedProviders(env: AppEnv): SharedProviders {
  if (cachedProviders) return cachedProviders;

  cachedProviders = {
    model: createLanguageModel(env),
    schedulingProvider: createSchedulingProvider(env),
    lineClient: createLineClient(env),
    adminAuth: createAdminAuth(env),
  };
  return cachedProviders;
}

export function createServices(env: AppEnv, conversationStore: ConversationStore): Services {
  return {
    ...getSharedProviders(env),
    conversationStore,
  };
}
