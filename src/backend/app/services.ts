import type { LanguageModel } from 'ai';
import type { AdminAuth } from '../admin/auth.ts';
import { createAdminAuth } from '../admin/auth.ts';
import type { AdminEnv } from '../admin/types.ts';
import { createLanguageModel } from '../ai/language-model/index.ts';
import { createLineClient } from '../channels/line/line-client.ts';
import type { LineClient } from '../channels/line/types.ts';
import type { ConfigStore, ConversationStore, ShopSettings } from '../core/types.ts';
import { createConfigStore } from '../providers/config-store.ts';
import { createConversationStore } from '../providers/conversation-store.ts';
import type { Database } from '../providers/db/types.ts';
import { createSchedulingProvider } from '../providers/scheduling/index.ts';
import type { SchedulingProvider } from '../providers/scheduling/types.ts';
import type { AppConfig } from './config.ts';
import { loadAppConfig, toShopSettings } from './config.ts';

// 放 Hono Context 裡
export type AppVariables = {
  Variables: {
    services: Services;
    // line 需要即時回應 200，工作要放給另一個thread，而不同平台寫法不同
    // node 不 await 就好，cloudflare worker 回應後會殺
    runInBackground: (task: Promise<unknown>) => void;
  };
};

export interface Services {
  model: LanguageModel | null; // AI
  shopSettings: ShopSettings; // 營業時間、部分提示詞
  conversationStore: ConversationStore;
  configStore: ConfigStore;
  schedulingProvider: SchedulingProvider | null; // google日曆
  lineClient: LineClient | null;
  adminAuth: AdminAuth | null; // 身分驗證模組
}

export async function createServices(env: AppConfig, database: Database): Promise<Services> {
  const configStore = createConfigStore(database);
  const conversationStore = createConversationStore(database);

  return {
    ...(await getSharedProviders(configStore, env)),
    conversationStore,
    configStore,
  };
}

// 扣掉綁 request 的兩個 store，其餘只由設定字串建出來，可以跨 request 重用
type SharedProviders = Omit<Services, 'conversationStore' | 'configStore'>;

// Node 上等同啟動時建一次;Cloudflare 上 warm isolate 內重用，cold start 就重算。
let cachedProviders: SharedProviders | undefined;

async function getSharedProviders(
  configStore: ConfigStore,
  env: AdminEnv,
): Promise<SharedProviders> {
  if (cachedProviders) return cachedProviders;

  const config = await loadAppConfig(configStore);
  cachedProviders = {
    model: createLanguageModel(config),
    shopSettings: toShopSettings(config),
    schedulingProvider: createSchedulingProvider(config),
    lineClient: createLineClient(config),
    adminAuth: createAdminAuth(env),
  };
  return cachedProviders;
}

// 後台儲存設定後呼叫。Cloudflare 上只清得掉當前 isolate，其他 isolate 要等自己重建
export function clearCachedProviders() {
  cachedProviders = undefined;
}
