import { Hono } from 'hono';
import type { LineEvent, LineWebhookBody } from '../channels/line/types.ts';
import { handleChat } from '../core/chat-service.ts';
import type { AppVariables } from './services.ts';

const FALLBACK_REPLY = '不好意思,系統暫時有點問題,請稍後再傳一次訊息,或直接打電話給店裡。';

const lineRoutes = new Hono<AppVariables>();

lineRoutes.post('/webhook', async (c) => {
  const { lineClient, model, conversationStore, schedulingProvider } = c.var.services;
  // 如果沒有設定 line 還是會開啟 /webhook 接口，但不會執行實際工作
  if (!lineClient) return c.text('LINE is not configured', 404);

  // step1.驗證發送請求的人是Line官方
  // 簽章是對原始 body 字串計算的,必須在 JSON.parse 之前驗證
  const body = await c.req.text();
  const signature = c.req.header('x-line-signature') ?? '';
  if (!(await lineClient.verifySignature(body, signature))) {
    return c.text('Invalid signature', 401);
  }

  // step2.處裡訊息與回應
  const { events } = JSON.parse(body) as LineWebhookBody;
  for (const event of events) {
    if (!isTextMessage(event)) continue;

    const task = handleChat(
      { sessionId: event.source.userId!, message: event.message!.text! },
      model,
      conversationStore,
      schedulingProvider,
    )
      .then((result) => result.reply || FALLBACK_REPLY)
      .catch((error) => {
        console.error('處理 LINE 訊息失敗:', error);
        return FALLBACK_REPLY;
      })
      .then((reply) => lineClient.replyText(event.replyToken!, reply))
      .catch((error) => console.error('LINE 回覆失敗:', error));

    c.var.runInBackground(task);
  }

  return c.text('OK');
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
