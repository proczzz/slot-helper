import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppVariables } from '../app/services.ts';
import { ADMIN_COOKIE_NAME } from './auth.ts';

const LoginSchema = z.object({ password: z.string() });

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
    httpOnly: true,
    secure: adminAuth.cookieSecure,
    sameSite: 'Strict',
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

export { adminRoutes };
