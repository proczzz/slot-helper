import { z } from 'zod';
import { MessagingConfigSchema, type MessagingClient } from '../types';

export const LineConfigSchema = MessagingConfigSchema;
export type LineConfig = z.infer<typeof LineConfigSchema>;

export interface LineProfile {
  displayName: string;
  pictureUrl?: string;
}

export interface LineClient extends MessagingClient {
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
