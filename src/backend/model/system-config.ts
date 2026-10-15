import z from 'zod';

export const SystemConfigSchema = z.object({
  // 顧客在 limitWindowMinutes 內問超過 limitTurns 輪就暫停 limitPauseMinutes 分鐘。
  // 0 代表關閉，連計數的查詢都不會發出
  limitPauseMinutes: z.number().int().min(0).max(1440).default(0),
  limitTurns: z.number().int().min(1).max(200).default(30),
  limitWindowMinutes: z.number().int().min(1).max(1440).default(10),
  limitNotify: z.boolean().default(true),

  historyTurns: z.number().int().min(0).max(50).default(15),
  historyDays: z.number().int().min(1).max(365).default(30),
  maxSteps: z.number().int().min(1).max(20).default(8),
  fallbackReply: z
    .string()
    .min(1, '請輸入保底訊息')
    .default('不好意思,系統暫時有點問題,請稍後再傳一次訊息,或直接打電話給店裡。'),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
