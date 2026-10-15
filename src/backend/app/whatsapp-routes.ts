import { Hono } from 'hono';
import type { AppVariables } from './services.ts';

const whatsappRoutes = new Hono<AppVariables>();

// 用於 Meta 設定 webhook 時，把 hub.challenge 原樣回去才算驗證通過。
// 這是 LINE 沒有的一步,所以同一個路徑要同時有 GET 與 POST
whatsappRoutes.get('/webhook', (c) => {
  const { whatsappClient } = c.var.services;
  if (!whatsappClient) return c.text('WhatsApp is not configured', 404);

  if (
    c.req.query('hub.mode') !== 'subscribe' ||
    !whatsappClient.verifyToken(c.req.query('hub.verify_token') ?? '')
  ) {
    return c.text('Invalid verify token', 403);
  }

  return c.text(c.req.query('hub.challenge') ?? '');
});

whatsappRoutes.post('/webhook', async (c) => {
  const { whatsappClient, messageService } = c.var.services;
  // 沒設定 WhatsApp 時接口還是開著，但不做任何事
  if (!whatsappClient) return c.text('WhatsApp is not configured', 404);

  // Step1. 驗證發送請求的人是 Meta 官方
  // (簽章是對原始 body 字串簽發的，要先取純文本)
  const body = await c.req.text();
  if (!(await whatsappClient.verifyRequest(body, c.req.raw.headers))) {
    return c.text('Invalid signature', 401);
  }
  if (!messageService) return c.text('OK'); // 有設定 WhatsApp 但沒 AI，回平台200

  // Step2. 處理訊息與回應(非阻塞)
  c.var.runInBackground(messageService.handleWebhook(whatsappClient, body));

  // Step3. 回應給 Meta 平台 (這時候 step2 應該還在別的現成跑)
  return c.text('OK');
});

export { whatsappRoutes };
