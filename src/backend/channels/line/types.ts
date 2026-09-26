export interface LineConfig {
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
}

export interface LineClient {
  verifySignature(body: string, signature: string): Promise<boolean>;
  replyText(replyToken: string, text: string): Promise<void>;
}

export interface LineWebhookBody {
  events: LineEvent[];
}

export interface LineEvent {
  type: string;
  replyToken?: string;
  source: { type: string; userId?: string };
  message?: { type: string; text?: string };
}
