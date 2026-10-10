import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { listAvailableModels } from '../adapter/ai/index.ts';
import { buildAuthorizeUrl, parseOutlookState } from '../adapter/scheduling/outlook-oauth.ts';
import { fetchOutlookCalendars } from '../adapter/scheduling/outlook.ts';
import {
  createTokenStore,
  loadOutlookSettings,
  loadTelegramConfig,
  SECTION_MAPPERS,
  SECTION_SCHEMAS,
} from '../app/config.ts';
import {
  OAUTH_COOKIE_PATH,
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
} from '../app/oauth-routes.ts';
import type { AppVariables } from '../app/services.ts';
import { clearCachedProviders } from '../app/services.ts';
import { TELEGRAM_COMMANDS } from '../app/telegram-routes.ts';
import { handleChat } from '../core/chat-service.ts';
import { ListModelsSchema } from '../model/dto/ai.ts';
import { ChatRequestSchema, TestCustomerSchema } from '../model/dto/chat.ts';
import { CustomerQuerySchema } from '../model/dto/customer.ts';
import { jsend } from '../model/dto/jsend.ts';
import { LoginSchema } from '../model/dto/login.ts';
import { OutlookAuthorizeSchema } from '../model/dto/outlook.ts';
import { ChangePasswordSchema } from '../model/dto/password.ts';
import { WebhookSchema } from '../model/dto/telegram.ts';
import type { ConfigKey } from '../repository/types.ts';
import { ADMIN_COOKIE_NAME } from './auth.ts';

type AdminVariables = {
  Variables: AppVariables['Variables'] & { username: string };
};

const adminRoutes = new Hono<AdminVariables>();

adminRoutes.post('/login', async (c) => {
  // Step1. 檢查:環境配置&驗證密碼
  const { adminAuth } = c.var.services;
  const { username, password } = LoginSchema.parse(await c.req.json());

  if (!(await adminAuth.authenticate(username, password))) {
    return c.json(jsend.fail('帳號或密碼錯誤'), 401);
  }

  // Step2. 發 jwt 憑證
  setCookie(c, ADMIN_COOKIE_NAME, await adminAuth.issueToken(username), {
    httpOnly: true, // JS 無法讀取此 cookie
    secure: true, // 非 https 瀏覽器發給後端(正式環境必須 true，本機開發才能用 false)
    sameSite: 'Strict', // 只有從本站發起的請求才會帶上這個 cookie
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return c.json(jsend.success(null));
});

adminRoutes.post('/logout', (c) => {
  deleteCookie(c, ADMIN_COOKIE_NAME, { path: '/' });
  return c.json(jsend.success(null));
});

// 以下路由都需要登入，驗證身分後context存入用戶名
adminRoutes.use('/*', async (c, next) => {
  const { adminAuth } = c.var.services;
  const token = getCookie(c, ADMIN_COOKIE_NAME);
  const username = token ? await adminAuth.verifyToken(token) : null;
  if (!username) {
    return c.body(null, 401);
  }

  c.set('username', username);
  await next();
});

adminRoutes.get('/me', (c) => c.json(jsend.success(null)));

adminRoutes.post('/password', async (c) => {
  const { adminAuth } = c.var.services;
  const { currentPassword, newPassword } = ChangePasswordSchema.parse(await c.req.json());

  if (!(await adminAuth.changePassword(c.var.username, currentPassword, newPassword))) {
    return c.json(jsend.fail({ currentPassword: '目前密碼錯誤' }), 400);
  }

  return c.json(jsend.success(null));
});

adminRoutes.get('/config/:section', async (c) => {
  const { configRepository } = c.var.services;
  const section = c.req.param('section') as ConfigKey;

  if (!SECTION_SCHEMAS[section]) return c.json(jsend.fail('未知的設定區塊'), 400);

  const raw = await configRepository.get(section);
  if (!raw) return c.json(jsend.success(null));

  const stored = JSON.parse(raw) as unknown;
  const mapper = SECTION_MAPPERS[section];

  return c.json(jsend.success(mapper ? mapper.toVo(stored) : stored));
});

adminRoutes.put('/config/:section', async (c) => {
  const { configRepository } = c.var.services;
  const section = c.req.param('section') as ConfigKey;

  const schema = SECTION_SCHEMAS[section];
  if (!schema) return c.json(jsend.fail('未知的設定區塊'), 400);

  const body = (await c.req.json()) as unknown;
  const mapper = SECTION_MAPPERS[section];

  let value: unknown;
  if (mapper) {
    const raw = await configRepository.get(section);
    value = mapper.toConfig(body, raw ? JSON.parse(raw) : null);
  } else {
    value = schema.parse(body);
  }

  await configRepository.set(section, JSON.stringify(value));
  clearCachedProviders();

  return c.json(jsend.success(null));
});

adminRoutes.post('/ai/models', async (c) => {
  const { provider, apiKey } = ListModelsSchema.parse(await c.req.json());
  return c.json(jsend.success(await listAvailableModels(provider, apiKey)));
});

adminRoutes.get('/calendar/labels', async (c) => {
  const { schedulingProvider } = c.var.services;
  if (!schedulingProvider) return c.json(jsend.success([]));

  return c.json(jsend.success(await schedulingProvider.getLabels()));
});

const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // 同 admin cookie,本機用 http 開發要改 false
  sameSite: 'Lax', // callback 是跨站頂層導覽,Strict 不會送出
  path: OAUTH_COOKIE_PATH,
  maxAge: 600, // 老闆同意的過程就10分鐘內
} as const;

// 取得微軟授權頁url，並預留cookies給callback頁，前端自己跳轉
adminRoutes.post('/outlook/authorize', async (c) => {
  const { configRepository } = c.var.services;
  const settings = await loadOutlookSettings(configRepository);
  if (!settings) {
    return c.json(jsend.fail('請先儲存 Client ID 與用戶端密碼'), 400);
  }

  const { redirectUri } = OutlookAuthorizeSchema.parse(await c.req.json());
  const state = crypto.randomUUID();

  setCookie(c, OAUTH_REDIRECT_COOKIE, redirectUri, OAUTH_COOKIE_OPTIONS);
  setCookie(c, OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS);

  // 組同意授權頁的 url 給前端
  return c.json(jsend.success({ url: buildAuthorizeUrl(settings, redirectUri, state) }));
});

// 問:現在是否連結(有refresh token嗎)?
adminRoutes.get('/outlook/connection', async (c) => {
  const { configRepository } = c.var.services;
  const state = parseOutlookState(await createTokenStore(configRepository).get());

  return c.json(jsend.success({ connected: !!state, accountEmail: state?.accountEmail ?? '' }));
});

// 移除目前的連結(移除refresh token)
adminRoutes.delete('/outlook/connection', async (c) => {
  const { configRepository } = c.var.services;
  await createTokenStore(configRepository).clear();

  return c.json(jsend.success(null));
});

// 診斷性質的端點,所以把 Graph 的錯誤原文交給老闆,而不是丟給 error-handler 變成 500
adminRoutes.get('/outlook/calendars', async (c) => {
  const { configRepository } = c.var.services;
  const settings = await loadOutlookSettings(configRepository);
  if (!settings) return c.json(jsend.success([]));

  try {
    const calendars = await fetchOutlookCalendars(settings, createTokenStore(configRepository));
    return c.json(jsend.success(calendars));
  } catch (error) {
    return c.json(jsend.fail(error instanceof Error ? error.message : '讀取日曆清單失敗'), 400);
  }
});

adminRoutes.get('/customers', async (c) => {
  const { customerRepository } = c.var.services;
  const { limit, before, channel } = CustomerQuerySchema.parse(c.req.query());

  return c.json(jsend.success(await customerRepository.list(limit, before, channel)));
});

adminRoutes.get('/customers/:id/messages', async (c) => {
  const { conversationRepository } = c.var.services;
  const id = decodeURIComponent(c.req.param('id'));
  const before = c.req.query('before');

  return c.json(
    jsend.success(
      await conversationRepository.listMessages(id, before ? Number(before) : null, 50),
    ),
  );
});

adminRoutes.post('/telegram/test', async (c) => {
  const { telegramClient } = c.var.services;
  if (!telegramClient) return c.json(jsend.fail('Telegram 尚未設定，請先儲存設定'), 400);

  // 這支端點的用途就是診斷,所以把 Telegram 的錯誤原文交給老闆,而不是丟給 error-handler 變成 500
  try {
    await telegramClient.sendText('SlotHelper 測試訊息。\n\n恭喜你成功接通 Telegram !!');
  } catch (error) {
    return c.json(jsend.fail(error instanceof Error ? error.message : '發送失敗'), 400);
  }

  return c.json(jsend.success(null));
});

adminRoutes.get('/telegram/webhook', async (c) => {
  const { telegramClient } = c.var.services;
  if (!telegramClient) return c.json(jsend.success(null));

  return c.json(jsend.success(await telegramClient.getWebhookInfo()));
});

adminRoutes.post('/telegram/webhook', async (c) => {
  const { telegramClient, configRepository } = c.var.services;
  const config = await loadTelegramConfig(configRepository);
  if (!telegramClient || !config) {
    return c.json(jsend.fail('Telegram 尚未設定，請先儲存設定'), 400);
  }

  // 網址由前端給。後端自己推導的話,反向代理會終止 TLS、內網後台的網域也不是對外網域,
  // 都推不出正確的值;瀏覽器本來就知道自己連的是哪裡。
  // 已登入者能把 webhook 指到任意網址,但他本來就能直接改密碼,不構成新的權限提升
  const { url } = WebhookSchema.parse(await c.req.json());

  // 純機器對機器的驗證碼,老闆不需要看到也不需要輸入,每次註冊都換新的
  const webhookSecret = crypto.randomUUID();

  // 先向 Telegram 註冊、成功才寫回設定。
  // 反過來的話註冊失敗就會留下一個 Telegram 不知道的驗證碼,原本還能用的 webhook 會跟著壞掉
  try {
    await telegramClient.setWebhook(url, webhookSecret);
  } catch (error) {
    return c.json(jsend.fail(error instanceof Error ? error.message : '註冊失敗'), 400);
  }

  await configRepository.set('telegram', JSON.stringify({ ...config, webhookSecret }));

  // 指令清單只影響「/」選單,失敗不該讓整個註冊算失敗
  await telegramClient.setCommands(TELEGRAM_COMMANDS).catch((error) => {
    console.error('設定 Telegram 指令清單失敗:', error);
  });

  return c.json(jsend.success(await telegramClient.getWebhookInfo()));
});

const TEST_CHANNEL = 'test';
// 建立或更新測試用的顧客
adminRoutes.post('/test-customers', async (c) => {
  const { customerRepository } = c.var.services;
  const { id, name } = TestCustomerSchema.parse(await c.req.json());

  await customerRepository.upsertProfile({
    id: `${TEST_CHANNEL}:${id}`,
    channel: TEST_CHANNEL,
    name,
    pictureUrl: null,
  });

  return c.json(jsend.success(null));
});

adminRoutes.post('/test-chat', async (c) => {
  const {
    model,
    shopConfig,
    conversationRepository,
    customerRepository,
    schedulingProvider,
    telegramClient,
  } = c.var.services;
  if (!model) return c.json(jsend.error('AI 尚未設定'), 503);

  const { sessionId, message } = ChatRequestSchema.parse(await c.req.json());
  const id = `${TEST_CHANNEL}:${sessionId}`;

  const customer = await customerRepository.findById(id);
  if (!customer) return c.body(null, 404);

  const result = await handleChat(
    id,
    customer.name,
    message,
    model,
    shopConfig,
    conversationRepository,
    schedulingProvider,
    telegramClient,
  );

  await customerRepository.updateLastMessage(id, message, Date.now());

  return c.json(jsend.success(result));
});

export { adminRoutes };
