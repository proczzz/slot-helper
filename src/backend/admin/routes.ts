import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { listAvailableModels } from '../adapter/ai/index.ts';
import { SECTION_SCHEMAS } from '../app/config.ts';
import type { AppVariables } from '../app/services.ts';
import { clearCachedProviders } from '../app/services.ts';
import { handleChat } from '../core/chat-service.ts';
import { ListModelsSchema } from '../model/dto/ai.ts';
import { ChatRequestSchema, TestCustomerSchema } from '../model/dto/chat.ts';
import { jsend } from '../model/dto/jsend.ts';
import { LoginSchema } from '../model/dto/login.ts';
import { ChangePasswordSchema } from '../model/dto/password.ts';
import type { ConfigKey } from '../repository/types.ts';
import { ADMIN_COOKIE_NAME } from './auth.ts';

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
  const before = c.req.query('before');

  return c.json(jsend.success(await customerRepository.list(before ? Number(before) : null, 20)));
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
  const { model, shopConfig, conversationRepository, customerRepository, schedulingProvider } =
    c.var.services;
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
  );

  await customerRepository.updateLastMessage(id, message, Date.now());

  return c.json(jsend.success(result));
});

export { adminRoutes };
