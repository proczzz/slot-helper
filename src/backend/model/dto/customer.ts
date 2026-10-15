import { z } from 'zod';

export const CustomerRequestSchema = z.object({
  channel: z.string().min(1).optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AiPauseRequestSchema = z.object({
  customerId: z.string().min(1),
  minutes: z.number().int().min(0).max(60 * 24 * 30), // 0 代表立即恢復
});

export const MessageRequestSchema = z.object({
  before: z.coerce.number().int().positive().optional(),
});
