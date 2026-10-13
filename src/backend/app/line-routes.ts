import { Hono } from 'hono';
import type { LineEvent, LineWebhookBody } from '../adapter/line/types.ts';
import type { AppVariables } from './services.ts';

const LINE_CHANNEL = 'line';

const lineRoutes = new Hono<AppVariables>();

lineRoutes.post('/webhook', async (c) => {
  // 從 context 注入需要的 services
  const { lineClient, messageService } = c.var.services;
  // 檢查: 如果沒有設定 line 還是會開啟 /webhook 接口，但不會執行實際工作
  if (!lineClient) return c.text('LINE is not configured', 404);

  // Step1. 驗證發送請求的人是 Line官方
  // (簽章是對原始 body 字串簽發的，要先取純文本)
  const body = await c.req.text();
  if (!(await lineClient.verifyRequest(body, c.req.raw.headers))) {
    return c.text('Invalid signature', 401);
  }
  if (!messageService) return c.text('OK'); // 有設定 Line 但沒 AI，回平台200
  const client = lineClient;
  const service = messageService;

  // Step2. 處裡訊息與回應(非阻塞)
  const { events } = JSON.parse(body) as LineWebhookBody;
  for (const event of events) {
    if (!isTextMessage(event)) continue;
    c.var.runInBackground(reply(event));
  }

  // Step3. 回應給 Line 平台
  // (這時候 step2 應該還在別的線程跑，客戶還沒收到訊息)
  return c.text('OK');

  async function reply(event: LineEvent) {
    const userId = event.source.userId!;
    // 查不到 用戶名&頭貼 就算了
    const profile = await client.getProfile(userId).catch(() => null);

    await service.handleMessage(client, {
      channel: LINE_CHANNEL,
      customerId: `${LINE_CHANNEL}:${userId}`,
      name: profile?.displayName ?? null,
      pictureUrl: profile?.pictureUrl ?? null,
      text: event.message!.text!,
      replyTo: event.replyToken!,
    });
  }
});

function isTextMessage(event: LineEvent): boolean {
  return (
    event.type === 'message' &&
    event.message?.type === 'text' &&
    !!event.message.text &&
    !!event.replyToken &&
    !!event.source.userId
  );
}

export { lineRoutes };
