import { z } from 'zod';

export const LineConfigSchema = z.object({
  channelSecret: z.string().min(1, '請輸入 Channel secret'),
  accessToken: z.string().min(1, '請輸入 Channel access token'),
});

export type LineConfig = z.infer<typeof LineConfigSchema>;

export interface LineProfile {
  displayName: string;
  pictureUrl?: string;
}

export interface LineClient {
  verifySignature(body: string, signature: string): Promise<boolean>;
  replyText(replyToken: string, text: string): Promise<void>;
  getProfile(userId: string): Promise<LineProfile | null>;
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
