import type { LanguageModel } from 'ai';
import { createLanguageModel } from '../adapter/ai/index.ts';
import { createLineClient } from '../adapter/line/line-client.ts';
import type { LineClient } from '../adapter/line/types.ts';
import { createSchedulingProvider } from '../adapter/scheduling/index.ts';
import type { SchedulingProvider } from '../adapter/scheduling/types.ts';
import { createTelegramClient } from '../adapter/telegram/telegram-client.ts';
import type { TelegramClient } from '../adapter/telegram/types.ts';
import type { AdminAuth } from '../admin/auth.ts';
import { createAdminAuth } from '../admin/auth.ts';
import type { ShopConfig } from '../core/shop-config.ts';
import type { Database } from '../db/types.ts';
import { createConfigRepository } from '../repository/config-repository.ts';
import { createConversationRepository } from '../repository/conversation-repository.ts';
import { createCustomerRepository } from '../repository/customer-repository.ts';
import type {
  ConfigRepository,
  ConversationRepository,
  CustomerRepository,
  UserRepository,
} from '../repository/types.ts';
import { createUserRepository } from '../repository/user-repository.ts';
import {
  loadAiKeys,
  loadLineConfig,
  loadSchedulingConfig,
  loadShopSettings,
  loadSystemConfig,
  loadTelegramConfig,
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
  shopConfig: ShopConfig; // 營業時間、部分提示詞
  conversationRepository: ConversationRepository;
  configRepository: ConfigRepository;
  customerRepository: CustomerRepository;
  schedulingProvider: SchedulingProvider | null; // google日曆
  lineClient: LineClient | null;
  telegramClient: TelegramClient | null; // 通知老闆,AI 處理不了時求助
  adminAuth: AdminAuth; // 身分驗證模組
}

export async function createServices(database: Database): Promise<Services> {
  const configRepository = createConfigRepository(database);
  const userRepository = createUserRepository(database);
  const customerRepository = createCustomerRepository(database);
  const conversationRepository = createConversationRepository(database);

  return {
    ...(await getSharedProviders(configRepository, userRepository)),
    configRepository,
    customerRepository,
    conversationRepository,
  };
}

// 扣掉綁 request 的兩個 repository，其餘只由設定字串建出來，可以跨 request 重用
type SharedProviders = Omit<
  Services,
  'configRepository' | 'conversationRepository' | 'customerRepository'
>;

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
    shopConfig: await loadShopSettings(configRepository),
    schedulingProvider: createSchedulingProvider(await loadSchedulingConfig(configRepository)),
    lineClient: createLineClient(await loadLineConfig(configRepository)),
    telegramClient: createTelegramClient(await loadTelegramConfig(configRepository)),
    adminAuth: createAdminAuth(userRepository, system!.jwtSecret),
  };
  return cachedProviders;
}

// 後台儲存設定後呼叫。Cloudflare 上只清得掉當前 isolate，其他 isolate 要等自己重建
export function clearCachedProviders() {
  cachedProviders = undefined;
}
