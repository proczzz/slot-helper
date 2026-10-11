import { Hono } from 'hono';
import type { WhatsappMessage, WhatsappWebhookBody } from '../adapter/whatsapp/types.ts';
import { handleChat } from '../core/chat-service.ts';
import type { AppVariables } from './services.ts';

const SIGNATURE_HEADER = 'x-hub-signature-256';
const WHATSAPP_CHANNEL = 'whatsapp';

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
  // 從 context 取:[llm、資料庫、日曆、通知]的實現
  const {
    whatsappClient,
    chatSettings,
    activeModel,
    shopConfig,
    conversationRepository,
    customerRepository,
    schedulingProvider,
    telegramClient,
  } = c.var.services;
  // 檢查: 如果沒有設定 whatsapp 還是會開啟 /webhook 接口，但不會執行實際工作
  if (!whatsappClient) return c.text('WhatsApp is not configured', 404);

  // Step1. 驗證發送請求的人是 Meta
  // (簽章是對原始 body 字串簽發的,要先取純文本;Meta 送的是 sha256= 加十六進位)
  const body = await c.req.text();
  const signature = c.req.header(SIGNATURE_HEADER) ?? '';
  if (!(await whatsappClient.verifySignature(body, signature))) {
    return c.text('Invalid signature', 401);
  }

  // Step2. 處理訊息與回應(非阻塞)
  // payload 嵌套三層,而且同一包會混入已送達、已讀的狀態回報 —— 那些沒有 messages
  const data = JSON.parse(body) as WhatsappWebhookBody;
  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const contacts = change.value?.contacts ?? [];
      for (const message of change.value?.messages ?? []) {
        if (!isTextMessage(message)) continue;
        // webhook 直接帶顧客名稱,不必像 LINE 再呼叫一次 getProfile
        const name = contacts.find((item) => item.wa_id === message.from)?.profile?.name ?? null;
        c.var.runInBackground(reply(message, name));
      }
    }
  }

  // Step3. 回應給 Meta
  // (這時候 step2 應該還在別的線程跑，客戶還沒收到訊息)
  return c.text('OK');

  async function reply(message: WhatsappMessage, name: string | null) {
    const client = whatsappClient!;
    const text = message.text!.body;

    try {
      if (!activeModel) return; // 沒 AI
      const id = `${WHATSAPP_CHANNEL}:${message.from}`;

      // [儲存/更新] 顧客名稱。WhatsApp 沒有提供頭像
      await customerRepository.upsertProfile({
        id,
        channel: WHATSAPP_CHANNEL,
        name,
        pictureUrl: null,
      });

      // 取得 AI 回應
      const result = await handleChat({
        customerId: id,
        customerName: name,
        message: text,
        chatSettings,
        activeModel,
        shopConfig,
        conversationRepository,
        schedulingProvider,
        telegramClient,
      });

      await customerRepository.updateLastMessage(id, text, Date.now());
      await client.sendText(message.from, result.reply);
    } catch (error) {
      console.error('處理 WhatsApp 訊息失敗:', error);
      await client.sendText(message.from, chatSettings.fallbackReply).catch((replyError) => {
        console.error('WhatsApp 回覆失敗:', replyError);
      });
    }
  }
});

function isTextMessage(message: WhatsappMessage): boolean {
  return message.type === 'text' && !!message.text?.body;
}

export { whatsappRoutes };
