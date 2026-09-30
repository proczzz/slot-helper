import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SECTION_SCHEMAS } from '../app/config.ts';
import { jsend } from '../app/jsend.ts';
import type { AppVariables } from '../app/services.ts';
import { clearCachedProviders } from '../app/services.ts';
import type { ConfigKey } from '../repository/types.ts';
import { ADMIN_COOKIE_NAME } from './auth.ts';
import { LoginSchema } from './model/login.ts';
import { ChangePasswordSchema } from './model/password.ts';

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

export { adminRoutes };
