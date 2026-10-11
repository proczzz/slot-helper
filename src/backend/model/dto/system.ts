import z from 'zod';
import { ChatSettingsSchema } from '../../core/system-config.ts';
import type { ConfigMapper } from './types.ts';

export const SystemRequestSchema = z.object({
  historyTurns: z.number().int().min(1).max(50),
  maxSteps: z.number().int().min(1).max(20),
  fallbackReply: z.string().min(1, '請輸入保底訊息'),
});

export const systemConfigMapper: ConfigMapper = {
  // 沒送的欄位沿用現有值。jwtSecret 不在 Request 裡，只能從 stored 帶回去
  toConfig(body, stored) {
    const input = SystemRequestSchema.parse(body);
    return { ...(stored as Record<string, unknown> | null), ...input };
  },
  // pick 出來的子 schema 會剝掉 jwtSecret，而且順便補上預設值
  toVo(stored) {
    return ChatSettingsSchema.parse(stored ?? undefined);
  },
};
