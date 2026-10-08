import type { WhatsappClient, WhatsappConfig } from './types.ts';

const API_VERSION = 'v25.0';
const API_BASE = 'https://graph.facebook.com';

export function createWhatsappClient(config: WhatsappConfig | null): WhatsappClient | null {
  if (!config) return null; // 老闆沒要用 WhatsApp
  const { phoneNumberId, accessToken, webhookSecret, challengeToken } = config;
  const encoder = new TextEncoder();
  const messagesUrl = `${API_BASE}/${API_VERSION}/${phoneNumberId}/messages`;

  return {
    // 只用於 Meta 設定 webhook 時
    verifyToken(token: string) {
      return token === challengeToken;
    },
    async verifySignature(body: string, signature: string) {
      // Meta 送的是 'sha256=' 加十六進位,和 LINE 的 base64 不同
      const hex = signature.startsWith('sha256=') ? signature.slice(7) : '';
      if (!/^[0-9a-f]{64}$/i.test(hex)) return false;

      const expected = Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16));

      const key = await crypto.subtle.importKey(
        'raw', // 金鑰格式=bytes
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' }, // HMAC-SHA256 可以理解成:需要金鑰的單向雜湊算法
        false, // key 物件無法再讀取出 channelSecret
        ['verify'], // 此 key 僅能驗證不能簽章
      );
      // 用 subtle.verify 而非自己用 === 比對字串,避免計時攻擊
      return crypto.subtle.verify('HMAC', key, expected, encoder.encode(body));
    },

    // 沒有 reply token，直接對顧客的號碼發送，24h內回覆都算在1000次(月)免費額度內
    async sendText(to: string, text: string) {
      const response = await fetch(messagesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      });

      if (!response.ok) {
        throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`);
      }
    },
  };
}
