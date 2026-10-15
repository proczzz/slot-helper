import { createLanguageModels } from '../adapter/ai/index.ts';
import type { ActiveModel } from '../adapter/ai/types.ts';
import { createLineClient } from '../adapter/line/line-client.ts';
import type { LineClient } from '../adapter/line/types.ts';
import { createSchedulingProvider } from '../adapter/scheduling/index.ts';
import { createTelegramClient } from '../adapter/telegram/telegram-client.ts';
import type { TelegramClient } from '../adapter/telegram/types.ts';
import type { WhatsappClient } from '../adapter/whatsapp/types.ts';
import { createWhatsappClient } from '../adapter/whatsapp/whatsapp-client.ts';
import type { AdminAuth } from '../admin/auth.ts';
import { createAdminAuth } from '../admin/auth.ts';
import { createChatService } from '../core/chat-service.ts';
import { createMessageService, type MessageService } from '../core/message-service.ts';
import { createNotifier, type Notifier } from '../core/notifications.ts';
import type { Database } from '../db/types.ts';
import { createConfigRepository } from '../repository/config-repository.ts';
import { createConversationRepository } from '../repository/conversation-repository.ts';
import { createCustomerRepository } from '../repository/customer-repository.ts';
import type { ConfigRepository, UserRepository } from '../repository/types.ts';
import { createUserRepository } from '../repository/user-repository.ts';
import { createAiService, type AiService } from './ai-service.ts';
import { createCalendarService, type CalendarService } from './calendar-service.ts';
import { createConfigService, type ConfigService } from './config-service.ts';
import { createCustomerService, type CustomerService } from './customer-service.ts';
import { ensureInitialized } from './initialize.ts';
import { loadProperties, type Properties } from './properties.ts';
import { createAiStateStore, createTokenStore } from './state-store.ts';
import { createTelegramService, type TelegramService } from './telegram-service.ts';

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
  adminAuth: AdminAuth; // 身分驗證模組
  configService: ConfigService; // 後台通用設定端點
  aiService: AiService;
  calendarService: CalendarService;
  telegramService: TelegramService;
  customerService: CustomerService;
  messageService: MessageService | null;

  // 從設定字串建立，可跨請求共用
  lineClient: LineClient | null;
  whatsappClient: WhatsappClient | null;
  notifier: Notifier;
}

export async function createServices(database: Database): Promise<Services> {
  const configRepository = createConfigRepository(database);
  const userRepository = createUserRepository(database);
  const customerRepository = createCustomerRepository(database);
  const conversationRepository = createConversationRepository(database);

  const cache = await getSharedCache(configRepository, userRepository);
  // ---內部底層依賴---
  const aiStateStore = createAiStateStore(configRepository, clearSharedCache);
  const schedulingProvider = createSchedulingProvider(
    cache.properties.scheduling,
    createTokenStore(configRepository),
  );
  const testModels = cache.testModels.length > 0 ? cache.testModels : cache.activeModels;
  const testChatService = buildChatService(testModels);
  const chatService = buildChatService(cache.activeModels);
  // ---controller 調用---
  const adminAuth = createAdminAuth(userRepository, cache.jwtSecret);
  const configService = createConfigService(configRepository, clearSharedCache);
  const aiService = createAiService(cache.properties, aiStateStore);
  const calendarService = createCalendarService(
    cache.properties,
    createTokenStore(configRepository),
    schedulingProvider,
  );
  const telegramService = createTelegramService(
    cache.properties,
    configRepository,
    cache.telegramClient,
    adminAuth,
    clearSharedCache,
  );
  const customerService = createCustomerService(
    customerRepository,
    conversationRepository,
    testChatService,
  );
  const messageService = createMessageService(
    cache.properties.system,
    customerRepository,
    conversationRepository,
    chatService,
    cache.notifier,
  );

  return {
    adminAuth,
    configService,
    aiService,
    calendarService,
    telegramService,
    customerService,
    messageService,

    lineClient: cache.lineClient,
    whatsappClient: cache.whatsappClient,
    notifier: cache.notifier,
  };
  function buildChatService(models: ActiveModel[]) {
    return createChatService(
      models,
      cache.properties.system,
      cache.properties.shop,
      conversationRepository,
      schedulingProvider,
      cache.notifier,
      aiStateStore,
    );
  }
}

// 快取不能包含資料庫
interface SharedCache {
  jwtSecret: string;
  properties: Properties;
  activeModels: ActiveModel[];
  testModels: ActiveModel[];
  lineClient: LineClient | null;
  whatsappClient: WhatsappClient | null;
  telegramClient: TelegramClient | null;
  notifier: Notifier;
}

// Node 上等同啟動時建一次;Cloudflare 上 warm isolate 內重用，cold start 就重算。
let sharedCache: SharedCache | undefined;

async function getSharedCache(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<SharedCache> {
  if (sharedCache) return sharedCache;

  const state = await ensureInitialized(configRepository, userRepository);
  const properties = await loadProperties(configRepository);
  const telegramClient = createTelegramClient(properties.telegram);
  const demoted = properties.aiState.map((item) => item.name);
  sharedCache = {
    jwtSecret: state.jwtSecret,
    properties,
    activeModels: createLanguageModels(properties.ai, 'active', demoted),
    testModels: createLanguageModels(properties.ai, 'test', demoted),
    lineClient: createLineClient(properties.line),
    whatsappClient: createWhatsappClient(properties.whatsapp),
    telegramClient,
    notifier: createNotifier(telegramClient),
  };
  return sharedCache;
}

// 後台儲存設定後呼叫。Cloudflare 上只清得掉當前 isolate，其他 isolate 要等自己重建
export function clearSharedCache() {
  sharedCache = undefined;
}
