import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppVariables } from '../app/services.ts';
import { clearCachedProviders } from '../app/services.ts';
import { ADMIN_COOKIE_NAME } from './auth.ts';
import { CONFIG_KEYS } from '../app/config.ts';

const LoginSchema = z.object({ password: z.string() });

const ConfigSchema = z.partialRecord(z.enum(CONFIG_KEYS), z.string());

const adminRoutes = new Hono<AppVariables>();

adminRoutes.post('/login', async (c) => {
  // Step1. 檢查:環境配置&驗證密碼
  const { adminAuth } = c.var.services;
  if (!adminAuth) return c.json({ error: '後台未設定' }, 404);

  const { password } = LoginSchema.parse(await c.req.json());
  if (!adminAuth.passwordMatches(password)) {
    return c.json({ error: '密碼錯誤' }, 401);
  }

  // Step2. 發 jwt 憑證
  setCookie(c, ADMIN_COOKIE_NAME, await adminAuth.issueToken(), {
    httpOnly: true, // JS 無法讀取此 cookie
    secure: true, // 非 https 瀏覽器發給後端
    sameSite: 'Strict', // 同ip + 同port 才能用這個 cookie
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return c.json({ ok: true });
});

adminRoutes.post('/logout', (c) => {
  deleteCookie(c, ADMIN_COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

// 以下路由都需要登入
adminRoutes.use('/*', async (c, next) => {
  const { adminAuth } = c.var.services;
  const token = getCookie(c, ADMIN_COOKIE_NAME);
  if (!adminAuth || !token || !(await adminAuth.verifyToken(token))) {
    return c.json({ error: '未登入' }, 401);
  }
  await next();
});

adminRoutes.get('/me', (c) => c.json({ ok: true }));

// 取全部設定
adminRoutes.get('/config', async (c) => {
  const { configStore } = c.var.services;
  const entries = await Promise.all(
    CONFIG_KEYS.map(async (key) => [key, (await configStore.get(key)) ?? ''] as const),
  );
  return c.json(Object.fromEntries(entries));
});

// 寫全部設定
adminRoutes.put('/config', async (c) => {
  const { configStore } = c.var.services;
  const values = ConfigSchema.parse(await c.req.json());

  await configStore.setMany(Object.entries(values).map(([key, value]) => ({ key, value })));

  // 清掉跨 request 快取,下一個 request 才會用到新設定
  clearCachedProviders();

  return c.json({ ok: true });
});

export { adminRoutes };
