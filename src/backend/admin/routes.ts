import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { AiKeysSchema } from '../ai/language-model/types.ts';
import { AI_CONFIG_KEY, CONFIG_KEYS, LINE_CONFIG_KEY } from '../app/config.ts';
import { jsend } from '../app/jsend.ts';
import type { AppVariables } from '../app/services.ts';
import { clearCachedProviders } from '../app/services.ts';
import { ADMIN_COOKIE_NAME } from './auth.ts';
import { LoginSchema } from './model/login.ts';
import { ChangePasswordSchema } from './model/password.ts';
import { LineConfigSchema } from '../channels/line/types.ts';

const ConfigSchema = z.partialRecord(z.enum(CONFIG_KEYS), z.string());

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

// 取全部設定
adminRoutes.get('/config', async (c) => {
  const { configRepository } = c.var.services;
  const entries = await Promise.all(
    CONFIG_KEYS.map(async (key) => [key, (await configRepository.get(key)) ?? ''] as const),
  );
  return c.json(jsend.success(Object.fromEntries(entries)));
});

// 寫全部設定
adminRoutes.put('/config', async (c) => {
  const { configRepository } = c.var.services;
  const values = ConfigSchema.parse(await c.req.json());

  await configRepository.setMany(Object.entries(values).map(([key, value]) => ({ key, value })));
  clearCachedProviders();

  return c.json(jsend.success(null));
});

adminRoutes.get('/ai', async (c) => {
  const { configRepository } = c.var.services;
  const raw = await configRepository.get(AI_CONFIG_KEY);
  return c.json(jsend.success(raw ? JSON.parse(raw) : []));
});

adminRoutes.put('/ai', async (c) => {
  const { configRepository } = c.var.services;
  const keys = AiKeysSchema.parse(await c.req.json());

  await configRepository.set(AI_CONFIG_KEY, JSON.stringify(keys));
  clearCachedProviders();

  return c.json(jsend.success(null));
});

adminRoutes.get('/line', async (c) => {
  const { configRepository } = c.var.services;
  const raw = await configRepository.get(LINE_CONFIG_KEY);
  return c.json(jsend.success(raw ? JSON.parse(raw) : null));
});

adminRoutes.put('/line', async (c) => {
  const { configRepository } = c.var.services;
  const config = LineConfigSchema.parse(await c.req.json());

  await configRepository.set(LINE_CONFIG_KEY, JSON.stringify(config));
  clearCachedProviders();

  return c.json(jsend.success(null));
});

export { adminRoutes };
