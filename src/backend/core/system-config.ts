import z from 'zod';

export const SystemConfigSchema = z.object({
  jwtSecret: z.string().min(1),
  initializedAt: z.string(),
  historyTurns: z.number().int().min(2).max(50).default(15),
  maxSteps: z.number().int().min(1).max(20).default(8),
  fallbackReply: z
    .string()
    .min(1, '請輸入保底訊息')
    .default('不好意思,系統暫時有點問題,請稍後再傳一次訊息,或直接打電話給店裡。'),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

// 老闆可調的那三個。核心邏輯只需要這些,不該拿到 jwtSecret
export const ChatSettingsSchema = SystemConfigSchema.pick({
  historyTurns: true,
  maxSteps: true,
  fallbackReply: true,
});

export type ChatSettings = z.infer<typeof ChatSettingsSchema>;
