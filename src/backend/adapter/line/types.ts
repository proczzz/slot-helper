import { z } from 'zod';
import { MessagingConfigSchema, type MessagingClient } from '../types';

export const LineConfigSchema = MessagingConfigSchema;
export type LineConfig = z.infer<typeof LineConfigSchema>;

export interface LineClient extends MessagingClient {}

export interface LineWebhookBody {
  events: LineEvent[];
}

// 所有 Lien 事件
export interface LineEvent {
  type: string;
  replyToken?: string;
  source: { type: string; userId?: string };
  message?: { type: string; text?: string };
}

// 僅 Line 文字訊息事件
export type LineTextEvent = LineEvent & {
  replyToken: string;
  source: { type: string; userId: string };
  message: { type: string; text: string };
};

export interface LineProfile {
  displayName: string;
  pictureUrl?: string;
}
