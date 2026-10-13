import { createLanguageModel } from '../adapter/ai/index.ts';
import type { ActiveModel } from '../adapter/ai/types.ts';
import { createLineClient } from '../adapter/line/line-client.ts';
import type { LineClient } from '../adapter/line/types.ts';
import { createSchedulingProvider } from '../adapter/scheduling/index.ts';
import type { SchedulingConfig, SchedulingProvider } from '../adapter/scheduling/types.ts';
import { createTelegramClient } from '../adapter/telegram/telegram-client.ts';
import type { TelegramClient } from '../adapter/telegram/types.ts';
import type { WhatsappClient } from '../adapter/whatsapp/types.ts';
import { createWhatsappClient } from '../adapter/whatsapp/whatsapp-client.ts';
import type { AdminAuth } from '../admin/auth.ts';
import { createAdminAuth } from '../admin/auth.ts';
import { createChatService, type ChatService } from '../core/chat-service.ts';
import { createMessageService, type MessageService } from '../core/message-service.ts';
import { createNotifier, type Notifier } from '../core/notifications.ts';
import type { ShopConfig } from '../core/shop-config.ts';
import { ChatSettingsSchema, type ChatSettings } from '../core/system-config.ts';
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
  createTokenStore,
  loadAiKeys,
  loadLineConfig,
  loadSchedulingConfig,
  loadShopSettings,
  loadTelegramConfig,
  loadWhatsappConfig,
} from './config.ts';
import { ensureInitialized } from './initialize.ts';

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
  // 包含 Database ，不可放進快取跨請求共用
  configRepository: ConfigRepository;
  customerRepository: CustomerRepository;
  conversationRepository: ConversationRepository;
  adminAuth: AdminAuth; // 身分驗證模組
  schedulingProvider: SchedulingProvider | null; // 日曆
  chatService: ChatService | null; // 核心處理訊息服務
  messageService: MessageService | null;

  // 從設定字串建立，可跨請求共用
  lineClient: LineClient | null;
  whatsappClient: WhatsappClient | null;
  telegramClient: TelegramClient | null; // 通知老闆,AI 處理不了時求助
  notifier: Notifier; // 通知模組
}

export async function createServices(database: Database): Promise<Services> {
  const configRepository = createConfigRepository(database);
  const userRepository = createUserRepository(database);
  const customerRepository = createCustomerRepository(database);
  const conversationRepository = createConversationRepository(database);

  const cache = await getSharedProviders(configRepository, userRepository);

  const schedulingProvider = createSchedulingProvider(
    cache.schedulingConfig,
    createTokenStore(configRepository),
  );
  const chatService = createChatService(
    cache.activeModel,
    cache.chatSettings,
    cache.shopConfig,
    conversationRepository,
    schedulingProvider,
    cache.notifier,
  );
  const messageService = createMessageService(
    chatService,
    customerRepository,
    cache.chatSettings.fallbackReply,
  );
  const adminAuth = createAdminAuth(userRepository, cache.jwtSecret);

  return {
    configRepository,
    customerRepository,
    conversationRepository,
    adminAuth,
    schedulingProvider,
    chatService,
    messageService,

    lineClient: cache.lineClient,
    whatsappClient: cache.whatsappClient,
    telegramClient: cache.telegramClient,
    notifier: cache.notifier,
  };
}

// 快取不能包含資料庫
interface SharedProviders {
  jwtSecret: string;
  chatSettings: ChatSettings;
  activeModel: ActiveModel | null;
  shopConfig: ShopConfig;
  schedulingConfig: SchedulingConfig | null;
  lineClient: LineClient | null;
  whatsappClient: WhatsappClient | null;
  telegramClient: TelegramClient | null;
  notifier: Notifier; // 通知模組
}

// Node 上等同啟動時建一次;Cloudflare 上 warm isolate 內重用，cold start 就重算。
let cachedProviders: SharedProviders | undefined;

async function getSharedProviders(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<SharedProviders> {
  if (cachedProviders) return cachedProviders;

  const system = await ensureInitialized(configRepository, userRepository);
  const telegramClient = createTelegramClient(await loadTelegramConfig(configRepository));

  cachedProviders = {
    jwtSecret: system.jwtSecret,
    chatSettings: ChatSettingsSchema.parse(system),
    activeModel: createLanguageModel(await loadAiKeys(configRepository)),
    shopConfig: await loadShopSettings(configRepository),
    schedulingConfig: await loadSchedulingConfig(configRepository),
    lineClient: createLineClient(await loadLineConfig(configRepository)),
    whatsappClient: createWhatsappClient(await loadWhatsappConfig(configRepository)),
    telegramClient,
    notifier: createNotifier(telegramClient),
  };
  return cachedProviders;
}

// 後台儲存設定後呼叫。Cloudflare 上只清得掉當前 isolate，其他 isolate 要等自己重建
export function clearCachedProviders() {
  cachedProviders = undefined;
}
