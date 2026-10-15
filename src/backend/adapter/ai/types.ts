import type { LanguageModel } from 'ai';
import z from 'zod';

// active 參與備援序列(順序決定先後)、test 只給後台測試、idle 僅保存
export const AiUsageSchema = z.enum(['active', 'test', 'idle']);
export type AiUsage = z.infer<typeof AiUsageSchema>;

// 存 config table 的 ai
export const AiConfigSchema = z
  .array(
    z.object({
      name: z.string().min(1, '請輸入名稱'),
      provider: z.string().min(1, '請選擇供應商'),
      model: z.string().min(1, '請輸入模型名稱'),
      apiKey: z.string().min(1, '請輸入 API key'),
      usage: AiUsageSchema.default('active'),
    }),
  )
  // name 必須唯一
  .refine((keys) => new Set(keys.map((key) => key.name)).size === keys.length, '名稱不可重複');

export type AiConfig = z.infer<typeof AiConfigSchema>;
export type AiKey = z.infer<typeof AiConfigSchema>[number];

// 存 config table 的 ai-state: 系統自己寫的降級名單
export const AiStateSchema = z.array(
  z.object({
    name: z.string(),
    reason: z.string(),
    at: z.number(),
  }),
);

export type AiState = z.infer<typeof AiStateSchema>;
export type AiDemotion = AiState[number]; // 陣列裡的 item

export interface AiStateStore {
  get(): Promise<AiState>;
  demote(name: string, reason: string): Promise<void>; // 已在名單裡的不重複追加
  restore(name: string): Promise<void>;
}

// 放 c.var.service
export interface ActiveModel {
  name: string;
  model: LanguageModel;
  provider: string; // 辨識用
  modelName: string; // 辨識用
}

export interface LanguageModelProvider {
  createModel(apiKey: string, model: string): LanguageModel;
}
