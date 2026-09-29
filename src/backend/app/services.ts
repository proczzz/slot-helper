import type { LanguageModel } from 'ai';
import type { AdminAuth } from '../admin/auth.ts';
import { createAdminAuth } from '../admin/auth.ts';
import { createLanguageModel } from '../ai/language-model/index.ts';
import { createLineClient } from '../channels/line/line-client.ts';
import type { LineClient } from '../channels/line/types.ts';
import type { ShopSettings } from '../core/model/shop-settings.ts';
import type { Database } from '../providers/db/types.ts';
import { createSchedulingProvider } from '../providers/scheduling/index.ts';
import type { SchedulingProvider } from '../providers/scheduling/types.ts';
import { createConfigRepository } from '../repository/config-repository.ts';
import { createConversationRepository } from '../repository/conversation-repository.ts';
import type {
  ConfigRepository,
  ConversationRepository,
  UserRepository,
} from '../repository/types.ts';
import { createUserRepository } from '../repository/user-repository.ts';
import {
  loadAiKeys,
  loadLineConfig,
  loadSchedulingConfig,
  loadShopSettings,
  loadSystemConfig,
} from './config.ts';
import { ensureInitialized } from './initialize.ts';

// 放 Hono Context 裡
export type AppVariables = {
  Variables: {
    services: Services;
    // line 需要即時回應 200，工作要放給另一個thread，而不同平台寫法不同
    // node 不 await 就好，cloudflare worker 回應後會殺
    runInBackground: (task: Promise<unknown>) => void;
    username: string; // 身分驗證後的
  };
};

export interface Services {
  model: LanguageModel | null; // AI
  shopSettings: ShopSettings; // 營業時間、部分提示詞
  conversationRepository: ConversationRepository;
  configRepository: ConfigRepository;
  schedulingProvider: SchedulingProvider | null; // google日曆
  lineClient: LineClient | null;
  adminAuth: AdminAuth; // 身分驗證模組
}

export async function createServices(database: Database): Promise<Services> {
  const configRepository = createConfigRepository(database);
  const conversationRepository = createConversationRepository(database);
  const userRepository = createUserRepository(database);

  return {
    ...(await getSharedProviders(configRepository, userRepository)),
    conversationRepository,
    configRepository,
  };
}

// 扣掉綁 request 的兩個 repository，其餘只由設定字串建出來，可以跨 request 重用
type SharedProviders = Omit<Services, 'conversationRepository' | 'configRepository'>;

// Node 上等同啟動時建一次;Cloudflare 上 warm isolate 內重用，cold start 就重算。
let cachedProviders: SharedProviders | undefined;

async function getSharedProviders(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<SharedProviders> {
  if (cachedProviders) return cachedProviders;

  await ensureInitialized(configRepository, userRepository);

  const system = await loadSystemConfig(configRepository);

  cachedProviders = {
    model: createLanguageModel(await loadAiKeys(configRepository)),
    shopSettings: await loadShopSettings(configRepository),
    schedulingProvider: createSchedulingProvider(await loadSchedulingConfig(configRepository)),
    lineClient: createLineClient(await loadLineConfig(configRepository)),
    adminAuth: createAdminAuth(userRepository, system!.jwtSecret),
  };
  return cachedProviders;
}

// 後台儲存設定後呼叫。Cloudflare 上只清得掉當前 isolate，其他 isolate 要等自己重建
export function clearCachedProviders() {
  cachedProviders = undefined;
}
