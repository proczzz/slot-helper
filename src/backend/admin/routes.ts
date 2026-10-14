import { Context, Hono } from 'hono';
import { buildAuthorizeUrl, parseOutlookState } from '../adapter/scheduling/outlook-oauth.ts';
import { fetchOutlookCalendars } from '../adapter/scheduling/outlook.ts';
import { createTokenStore, loadOutlookSettings, loadTelegramConfig } from '../app/config.ts';
import { startOauthSession } from '../app/oauth-cookies.ts';
import type { AppVariables } from '../app/services.ts';
import { TELEGRAM_COMMANDS } from '../app/telegram-routes.ts';
import { ExpectedError } from '../core/app-error.ts';
import { ListModelsRequestSchema, RestoreDemotionRequestSchema } from '../model/dto/ai.ts';
import { ChatRequestSchema, TestCustomerSchema } from '../model/dto/chat.ts';
import { AiPauseSchema, CustomerQuerySchema } from '../model/dto/customer.ts';
import { jsend } from '../model/dto/jsend.ts';
import { LoginSchema } from '../model/dto/login.ts';
import { OutlookAuthorizeSchema } from '../model/dto/outlook.ts';
import { ChangePasswordRequestSchema } from '../model/dto/password.ts';
import { WebhookSchema } from '../model/dto/telegram.ts';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './auth.ts';

type AdminVariables = {
  Variables: AppVariables['Variables'] & { username: string };
};

const adminRoutes = new Hono<AdminVariables>();

adminRoutes.post('/login', async (c) => {
  const { adminAuth, notifier } = c.var.services;
  const { username, password } = LoginSchema.parse(await readJson(c));
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
  const { currentPassword, newPassword } = ChangePasswordRequestSchema.parse(await readJson(c));
  // 驗證密碼
  const changed = await adminAuth.changePassword(c.var.username, currentPassword, newPassword);

  if (!changed) return c.json(jsend.fail({ currentPassword: '目前密碼錯誤' }), 400);

  return c.json(jsend.success(null));
});

adminRoutes.get('/config/:section', async (c) => {
  const { configService } = c.var.services;
  const section = c.req.param('section');

  const config = await configService.read(section);
  return c.json(jsend.success(config));
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
  const request = ListModelsRequestSchema.parse(await readJson(c));

  const models = await aiService.listModels(request);
  return c.json(jsend.success(models));
});

adminRoutes.get('/ai/demotions', async (c) => {
  const { aiService } = c.var.services;

  const demotions = await aiService.demotions();
  return c.json(jsend.success(demotions));
});

adminRoutes.post('/ai/demotions/restore', async (c) => {
  const { aiService } = c.var.services;
  const { keyName } = RestoreDemotionRequestSchema.parse(await readJson(c));

  await aiService.restore(keyName);
  return c.json(jsend.success(null));
});

adminRoutes.get('/calendar/labels', async (c) => {
  const { schedulingProvider } = c.var.services;

  if (!schedulingProvider) return c.json(jsend.success([]));

  const labels = await schedulingProvider.getLabels();
  return c.json(jsend.success(labels));
});

// 取得微軟授權頁url，並預留cookies給callback頁，前端自己跳轉
adminRoutes.post('/outlook/authorize', async (c) => {
  const { configRepository } = c.var.services;
  const { redirectUri } = OutlookAuthorizeSchema.parse(await readJson(c));

  const settings = await loadOutlookSettings(configRepository);
  if (!settings) {
    return c.json(jsend.fail('請先儲存 Client ID 與用戶端密碼'), 400);
  }

  const state = startOauthSession(c, redirectUri);

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

  const calendars = await fetchOutlookCalendars(settings, createTokenStore(configRepository));
  return c.json(jsend.success(calendars));
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

// 暫停 AI 回覆這位顧客，期間沉默。minutes 傳 0 代表恢復。到期時間由後端算
adminRoutes.post('/customers/ai-pause', async (c) => {
  const { customerRepository } = c.var.services;
  const { customerId, minutes } = AiPauseSchema.parse(await readJson(c));

  await customerRepository.pauseAi(customerId, minutes > 0 ? Date.now() + minutes * 60_000 : null);
  return c.json(jsend.success(null));
});

adminRoutes.post('/telegram/test', async (c) => {
  const { telegramClient } = c.var.services;
  if (!telegramClient) return c.json(jsend.fail('Telegram 尚未設定，請先儲存設定'), 400);

  // 這支端點的用途就是診斷,所以把 Telegram 的錯誤原文交給老闆,而不是丟給 error-handler 變成 500
  try {
    await telegramClient.sendText('SlotHelper 測試訊息\n\n恭喜你成功接通 Telegram !! 🥳🥳');
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
  const { url } = WebhookSchema.parse(await readJson(c));

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
  const { id, name } = TestCustomerSchema.parse(await readJson(c));

  await customerRepository.upsertProfile({
    id: `${TEST_CHANNEL}:${id}`,
    channel: TEST_CHANNEL,
    name,
    pictureUrl: null,
  });

  return c.json(jsend.success(null));
});

adminRoutes.post('/test-chat', async (c) => {
  const { customerRepository, testChatService } = c.var.services;
  if (!testChatService) return c.json(jsend.error('AI 尚未設定'), 503); // 沒 AI 就沒 chatService

  const { sessionId, message } = ChatRequestSchema.parse(await readJson(c));
  const id = `${TEST_CHANNEL}:${sessionId}`;

  const customer = await customerRepository.findById(id);
  if (!customer) return c.body(null, 404);

  const result = await testChatService.handleChat(id, customer.name, message);

  await customerRepository.updateLastMessage(id, message, Date.now());

  return c.json(jsend.success(result));
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
