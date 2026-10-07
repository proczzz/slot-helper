import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { listAvailableModels } from '../adapter/ai/index.ts';
import { loadTelegramConfig, SECTION_SCHEMAS } from '../app/config.ts';
import type { AppVariables } from '../app/services.ts';
import { clearCachedProviders } from '../app/services.ts';
import { handleChat } from '../core/chat-service.ts';
import { ListModelsSchema } from '../model/dto/ai.ts';
import { ChatRequestSchema, TestCustomerSchema } from '../model/dto/chat.ts';
import { CustomerQuerySchema } from '../model/dto/customer.ts';
import { jsend } from '../model/dto/jsend.ts';
import { LoginSchema } from '../model/dto/login.ts';
import { ChangePasswordSchema } from '../model/dto/password.ts';
import type { ConfigKey } from '../repository/types.ts';
import { ADMIN_COOKIE_NAME } from './auth.ts';
import { TELEGRAM_COMMANDS } from '../app/telegram-routes.ts';

const adminRoutes = new Hono<AppVariables>();

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
  return c.json(jsend.success(raw ? JSON.parse(raw) : null));
});

adminRoutes.put('/config/:section', async (c) => {
  const { configRepository } = c.var.services;
  const section = c.req.param('section') as ConfigKey;

  const schema = SECTION_SCHEMAS[section];
  if (!schema) return c.json(jsend.fail('未知的設定區塊'), 400);

  const value = schema.parse(await c.req.json());
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
  if (!telegramClient) return c.json(jsend.fail('Telegram 尚未設定，請先儲存設定'), 400);

  const config = await loadTelegramConfig(configRepository);
  if (!config?.webhookSecret) return c.json(jsend.fail('請先產生 Webhook 驗證碼並儲存'), 400);

  // 網址從這個請求本身推出來,老闆不必知道自己的網域。
  // 反向代理(ngrok、Cloudflare Tunnel)會在它那端終止 TLS 再用 http 轉進來,
  // 所以協議與主機要優先採信 X-Forwarded-*,否則推出來的是 http,Telegram 會拒收
  const requestUrl = new URL(c.req.url);
  const protocol =
    c.req.header('x-forwarded-proto')?.split(',')[0]?.trim() ||
    requestUrl.protocol.replace(':', '');
  const host = c.req.header('x-forwarded-host')?.split(',')[0]?.trim() || requestUrl.host;
  const url = `${protocol}://${host}/telegram/webhook`;

  // 註冊失敗幾乎都是網址不符合 Telegram 的要求,屬於可預期的失敗
  try {
    await telegramClient.setWebhook(url, config.webhookSecret);
    // 失敗不影響 webhook 本身,但清單沒送出老闆就看不到「/」選單
    await telegramClient.setCommands(TELEGRAM_COMMANDS);
  } catch (error) {
    return c.json(jsend.fail(error instanceof Error ? error.message : '註冊失敗'), 400);
  }

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
