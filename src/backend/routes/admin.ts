import { Context, Hono } from 'hono';
import type { AppVariables } from '../boot/services.ts';
import { ExpectedError } from '../core/app-error.ts';
import { ListModelsReqSchema, RestoreDemotionReqSchema } from '../model/dto/ai.ts';
import { ChatReqSchema, TestCustomerReqSchema } from '../model/dto/chat.ts';
import {
  AiPauseReqSchema,
  CustomerQuerySchema,
  MessageQuerySchema,
} from '../model/dto/customer.ts';
import { jsend } from '../model/dto/jsend.ts';
import { LoginReqSchema } from '../model/dto/login.ts';
import { OutlookAuthReqSchema } from '../model/dto/outlook.ts';
import { ChangePasswordReqSchema } from '../model/dto/password.ts';
import { WebhookReqSchema } from '../model/dto/telegram.ts';
import { startOauthSession } from './oauth-cookies.ts';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookies.ts';

type AdminVariables = {
  Variables: AppVariables['Variables'] & { username: string };
};

const adminRoutes = new Hono<AdminVariables>();

adminRoutes.post('/login', async (c) => {
  const { adminAuth, notifier } = c.var.services;
  const { username, password } = LoginReqSchema.parse(await readJson(c));
  // 驗證密碼
  const authenticated = await adminAuth.authenticate(username, password);
  // [背景] 登入通知
  c.var.runInBackground(notifier.login({ success: authenticated, ip: clientIp(c) }));

  if (!authenticated) return c.json(jsend.fail('帳號或密碼錯誤'), 401);

  setSessionCookie(c, await adminAuth.issueToken(username));
  return c.json(jsend.success(null));
});

adminRoutes.post('/logout', (c) => {
  clearSessionCookie(c);
  return c.json(jsend.success(null));
});

// 以下路由都需要登入，驗證身分後context存入用戶名
adminRoutes.use('/*', async (c, next) => {
  const { adminAuth } = c.var.services;
  const token = readSessionCookie(c);
  const username = token ? await adminAuth.verifyToken(token) : null;

  if (!username) return c.body(null, 401);

  c.set('username', username);
  await next();
  setSessionCookie(c, await adminAuth.issueToken(username)); // 更新 jwt
});

adminRoutes.get('/me', (c) => c.json(jsend.success({ username: c.var.username })));

adminRoutes.post('/me/password', async (c) => {
  const { adminAuth } = c.var.services;
  const { currentPassword, newPassword } = ChangePasswordReqSchema.parse(await readJson(c));
  // 驗證密碼
  const changed = await adminAuth.changePassword(c.var.username, currentPassword, newPassword);

  if (!changed) return c.json(jsend.fail({ currentPassword: '目前密碼錯誤' }), 400);

  return c.json(jsend.success(null));
});

adminRoutes.get('/config/:section', async (c) => {
  const { configService } = c.var.services;
  const section = c.req.param('section');

  return c.json(jsend.success(await configService.read(section)));
});

adminRoutes.put('/config/:section', async (c) => {
  const { configService } = c.var.services;
  const section = c.req.param('section');
  const body = await readJson(c);

  await configService.write(section, body);
  return c.json(jsend.success(null));
});

adminRoutes.post('/ai/models', async (c) => {
  const { aiService } = c.var.services;
  const request = ListModelsReqSchema.parse(await readJson(c));

  return c.json(jsend.success(await aiService.listModels(request)));
});

adminRoutes.get('/ai/demotions', async (c) => {
  const { aiService } = c.var.services;

  return c.json(jsend.success(await aiService.demotions()));
});

adminRoutes.post('/ai/demotions/restore', async (c) => {
  const { aiService } = c.var.services;
  const { name } = RestoreDemotionReqSchema.parse(await readJson(c));

  return c.json(jsend.success(await aiService.restore(name)));
});

adminRoutes.get('/calendar/labels', async (c) => {
  const { calendarService } = c.var.services;

  return c.json(jsend.success(await calendarService.labels()));
});

// 取得微軟授權頁url，並預留cookies給callback頁，前端自己跳轉
adminRoutes.post('/outlook/authorize', async (c) => {
  const { calendarService } = c.var.services;
  const { redirectUri } = OutlookAuthReqSchema.parse(await readJson(c));
  const state = startOauthSession(c, redirectUri);

  return c.json(jsend.success({ url: await calendarService.authorizeUrl(redirectUri, state) }));
});

// 問:現在是否連結(有 refresh token 嗎)?
adminRoutes.get('/outlook/connection', async (c) => {
  const { calendarService } = c.var.services;

  return c.json(jsend.success(await calendarService.connection()));
});

// 移除目前的連結(移除 refresh token)
adminRoutes.delete('/outlook/connection', async (c) => {
  const { calendarService } = c.var.services;

  await calendarService.disconnect();
  return c.json(jsend.success(null));
});

// 取得 outlook 日曆列表
adminRoutes.get('/outlook/calendars', async (c) => {
  const { calendarService } = c.var.services;

  return c.json(jsend.success(await calendarService.calendars()));
});

adminRoutes.post('/telegram/test', async (c) => {
  const { telegramService } = c.var.services;
  await telegramService.sendTest();

  return c.json(jsend.success(null));
});

adminRoutes.get('/telegram/webhook', async (c) => {
  const { telegramService } = c.var.services;

  return c.json(jsend.success(await telegramService.webhookInfo()));
});

adminRoutes.post('/telegram/webhook', async (c) => {
  const { telegramService } = c.var.services;
  const { url } = WebhookReqSchema.parse(await readJson(c));

  return c.json(jsend.success(await telegramService.registerWebhook(url)));
});

adminRoutes.get('/customers', async (c) => {
  const { customerService } = c.var.services;
  const { limit, before, channel } = CustomerQuerySchema.parse(c.req.query());

  return c.json(jsend.success(await customerService.list(limit, before, channel)));
});

adminRoutes.get('/customers/:id/messages', async (c) => {
  const { customerService } = c.var.services;
  const { before } = MessageQuerySchema.parse(c.req.query());

  return c.json(jsend.success(await customerService.messages(c.req.param('id'), before ?? null)));
});

// 暫停 AI 回覆這位顧客，期間沉默。minutes 傳 0 代表恢復。到期時間由後端算
adminRoutes.post('/customers/ai-pause', async (c) => {
  const { customerService } = c.var.services;
  const { customerId, minutes } = AiPauseReqSchema.parse(await readJson(c));

  await customerService.pauseAi(customerId, minutes);
  return c.json(jsend.success(null));
});

adminRoutes.post('/test-customers', async (c) => {
  const { customerService } = c.var.services;
  const { id, name } = TestCustomerReqSchema.parse(await readJson(c));

  await customerService.upsertTestCustomer(id, name);
  return c.json(jsend.success(null));
});

adminRoutes.post('/test-chat', async (c) => {
  const { customerService } = c.var.services;
  const { sessionId, message } = ChatReqSchema.parse(await readJson(c));

  return c.json(jsend.success(await customerService.testChat(sessionId, message)));
});

// Cloudflare 的 CF-Connecting-IP 由邊緣填入,可信;
// 自架時只有 X-Forwarded-For,而那個 header 任何人都能偽造,只能當線索
function clientIp(c: Context<AdminVariables>): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return c.req.header('cf-connecting-ip') ?? forwarded ?? '未知';
}

// 外部送來的 body 不是合法 JSON —— 呼叫端的問題,不是系統故障
async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ExpectedError('請求內容不是合法的 JSON');
  }
}

export { adminRoutes };
