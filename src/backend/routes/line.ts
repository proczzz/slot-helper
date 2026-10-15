import { Hono } from 'hono';
import type { AppVariables } from '../boot/services.ts';

const lineRoutes = new Hono<AppVariables>();

lineRoutes.post('/webhook', async (c) => {
  const { lineClient, messageService } = c.var.services;
  // 沒設定 LINE 時接口還是開著，但不做任何事
  if (!lineClient) return c.text('LINE is not configured', 404);

  // Step1. 驗證發送請求的人是 Line 官方
  // (簽章是對原始 body 字串簽發的，要先取純文本)
  const body = await c.req.text();
  if (!(await lineClient.verifyRequest(body, c.req.raw.headers))) {
    return c.text('Invalid signature', 401);
  }
  if (!messageService) return c.text('OK'); // 有設定 LINE 但沒 AI，回平台200

  // Step2. 處理訊息與回應(非阻塞)
  c.var.runInBackground(messageService.handleWebhook(lineClient, body));

  // Step3. 回應給 Line 平台 (這時候 step2 應該還在別的現成跑)
  return c.text('OK');
});

export { lineRoutes };
