import { Hono } from 'hono';
import type { LineEvent, LineWebhookBody } from '../adapter/line/types.ts';
import type { AppVariables } from './services.ts';

const LINE_CHANNEL = 'line';

const lineRoutes = new Hono<AppVariables>();

lineRoutes.post('/webhook', async (c) => {
  // 從 context 取:[llm、資料庫、日曆]的實現
  const { lineClient, chatSettings, customerRepository, chatService } = c.var.services;
  // 檢查: 如果沒有設定 line 還是會開啟 /webhook 接口，但不會執行實際工作
  if (!lineClient) return c.text('LINE is not configured', 404);

  // Step1. 驗證發送請求的人是 Line官方
  // (簽章是對原始 body 字串簽發的，要先取純文本)
  const body = await c.req.text();
  if (!(await lineClient.verifyRequest(body, c.req.raw.headers))) {
    return c.text('Invalid signature', 401);
  }

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
    const replyToken = event.replyToken!;
    const client = lineClient!;

    try {
      if (!chatService) return; // 沒 AI 就沒 chatService

      const id = `${LINE_CHANNEL}:${userId}`;
      const profile = await client.getProfile(userId);

      // [儲存/更新] line 好友名稱、頭貼
      await customerRepository.upsertProfile({
        id,
        channel: LINE_CHANNEL,
        name: profile?.displayName ?? null,
        pictureUrl: profile?.pictureUrl ?? null,
      });

      // 取得 AI 回應
      const result = await chatService.handleChat(
        id,
        profile?.displayName ?? null,
        event.message!.text!,
      );

      await customerRepository.updateLastMessage(id, event.message!.text!, Date.now());
      await client.reply(replyToken, result.reply);
    } catch (error) {
      console.error('處理 LINE 訊息失敗:', error);
      await client.reply(replyToken, chatSettings.fallbackReply).catch((replyError) => {
        console.error('LINE 回覆失敗:', replyError);
      });
    }
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
