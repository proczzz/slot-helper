import type { IncomingMessage } from '../types.ts';
import type {
  LineClient,
  LineConfig,
  LineEvent,
  LineProfile,
  LineTextEvent,
  LineWebhookBody,
} from './types.ts';

const CHANNEL = 'line';
const REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const PROFILE_URL = 'https://api.line.me/v2/bot/profile';
const SIGNATURE_HEADER = 'x-line-signature';

export function createLineClient(config: LineConfig | null): LineClient | null {
  if (!config) return null; // 老闆沒要用line
  const { webhookSecret, accessToken } = config;
  const encoder = new TextEncoder();

  return {
    async verifyRequest(body, headers) {
      const signature = headers.get(SIGNATURE_HEADER) ?? '';

      let signatureBytes: Uint8Array;
      try {
        signatureBytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
      } catch {
        return false;
      }

      const key = await crypto.subtle.importKey(
        'raw', // 金鑰格式=bytes
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' }, // HMAC-SHA256 可以理解成:需要金鑰的單向雜湊算法
        false, // key 物件無法再讀取出 webhookSecret
        ['verify'], // 此 key 僅能驗證不能簽章
      );
      // 用 subtle.verify 而非自己用===比對字串,避免計時攻擊
      return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(body));
    },

    async reply(replyToken, text) {
      const response = await fetch(REPLY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
      });
      if (!response.ok) {
        throw new Error(`LINE reply failed: ${response.status} ${await response.text()}`);
      }
    },

    async parseMessages(body) {
      const { events } = JSON.parse(body) as LineWebhookBody;

      // replyToken 一分鐘失效,profile 要併發查
      return Promise.all(events.filter(isTextEvent).map(toIncoming));
    },
  };

  async function toIncoming(event: LineTextEvent): Promise<IncomingMessage> {
    const userId = event.source.userId;
    const profile = await getProfile(userId);

    return {
      channel: CHANNEL,
      customerId: `${CHANNEL}:${userId}`,
      name: profile?.displayName ?? null,
      pictureUrl: profile?.pictureUrl ?? null,
      text: event.message.text,
      replyTo: event.replyToken,
    };
  }

  async function getProfile(userId: string): Promise<LineProfile | null> {
    try {
      const response = await fetch(`${PROFILE_URL}/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        console.error(`取得 LINE 顧客資料失敗: ${response.status}`);
        return null;
      }

      return (await response.json()) as LineProfile;
    } catch (error) {
      console.error('取得 LINE 顧客資料失敗:', error); // 查不到名稱不影響回覆
      return null;
    }
  }
}

function isTextEvent(event: LineEvent): event is LineTextEvent {
  return (
    event.type === 'message' &&
    event.message?.type === 'text' &&
    !!event.message.text &&
    !!event.replyToken &&
    !!event.source.userId
  );
}
