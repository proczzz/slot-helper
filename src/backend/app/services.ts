import type { LanguageModel } from 'ai';
import type { AdminAuth } from '../admin/auth.ts';
import { createAdminAuth } from '../admin/auth.ts';
import type { AdminEnv } from '../admin/types.ts';
import { createLanguageModel } from '../ai/language-model/index.ts';
import type { LanguageModelEnv } from '../ai/language-model/types.ts';
import { createLineClient } from '../channels/line/line-client.ts';
import type { LineClient, LineEnv } from '../channels/line/types.ts';
import type { ConfigStore, ConversationStore } from '../core/types.ts';
import { createConfigStore } from '../providers/config-store.ts';
import { createConversationStore } from '../providers/conversation-store.ts';
import type { Database } from '../providers/db/types.ts';
import { createSchedulingProvider } from '../providers/scheduling/index.ts';
import type { SchedulingProvider, SchedulingProviderEnv } from '../providers/scheduling/types.ts';

// CloudflareBindings 和 process.env 都能直接傳進來
export interface AppEnv extends LanguageModelEnv, SchedulingProviderEnv, LineEnv, AdminEnv {}

// 放 Context 裡
export interface Services {
  model: LanguageModel | null;
  conversationStore: ConversationStore;
  configStore: ConfigStore;
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

// 這些設定存在 config 表，啟動時不必存在，由後台填寫
export const CONFIG_KEYS = [
  'AI_PROVIDER',
  'DEEPSEEK_API_KEY',
  'ANTHROPIC_API_KEY',
  'SCHEDULING_PROVIDER',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CALENDAR_ID',
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
] as const;

// 從資料庫讀
async function loadConfig(configStore: ConfigStore): Promise<AppEnv> {
  const entries = await Promise.all(
    CONFIG_KEYS.map(async (key) => [key, await configStore.get(key)] as const),
  );
  return Object.fromEntries(entries.filter(([, value]) => value !== null));
}

// 扣掉綁 request 的兩個 store，其餘只由設定字串建出來，可以跨 request 重用
type SharedProviders = Omit<Services, 'conversationStore' | 'configStore'>;

// 快取可抽換的 AI模型、預約工具
let cachedProviders: SharedProviders | undefined;

async function getSharedProviders(
  configStore: ConfigStore,
  env: AdminEnv,
): Promise<SharedProviders> {
  if (cachedProviders) return cachedProviders;

  const config = await loadConfig(configStore);

  cachedProviders = {
    model: createLanguageModel(config),
    schedulingProvider: createSchedulingProvider(config),
    lineClient: createLineClient(config),
    adminAuth: createAdminAuth(env), // 只有後台讀環境
  };
  return cachedProviders;
}

// 後台儲存設定後呼叫。Cloudflare 上只清得掉當前 isolate,其他 isolate 要等自己重建
export function clearCachedProviders() {
  cachedProviders = undefined;
}

export async function createServices(env: AppEnv, database: Database): Promise<Services> {
  const configStore = createConfigStore(database);

  return {
    ...(await getSharedProviders(configStore, env)),
    conversationStore: createConversationStore(database),
    configStore,
  };
}
