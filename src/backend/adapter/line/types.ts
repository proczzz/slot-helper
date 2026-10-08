import { z } from 'zod';
import { MessagingConfigSchema } from '../types';

export const LineConfigSchema = MessagingConfigSchema;
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
