import type { LanguageModel } from 'ai';
import z from 'zod';

// active 參與備援序列(順序決定先後)、test 只給後台測試、idle 僅保存
export const AiUsageSchema = z.enum(['active', 'test', 'idle']);
export type AiUsage = z.infer<typeof AiUsageSchema>;

// 存 config table
export const AiConfigSchema = z
  .array(
    z.object({
      name: z.string().min(1, '請輸入名稱'),
      provider: z.string().min(1, '請選擇供應商'),
      apiKey: z.string().min(1, '請輸入 API key'),
      model: z.string().min(1, '請輸入模型名稱'),
      usage: AiUsageSchema.default('active'),
    }),
  )
  // name 是降級名單指向這一組的唯一識別,不能用陣列索引(老闆刪掉中間一筆就會配錯)
  .refine((keys) => new Set(keys.map((key) => key.name)).size === keys.length, '名稱不可重複');

export type AiConfig = z.infer<typeof AiConfigSchema>;
export type AiKey = z.infer<typeof AiConfigSchema>[number];

// 存 service
export interface ActiveModel {
  name: string; // 對應 ai 設定裡的名稱
  model: LanguageModel;
  provider: string;
  modelName: string; // 存進對話紀錄時分辨是哪個 llm 回覆使用
}

export interface LanguageModelProvider {
  createModel(apiKey: string, model: string): LanguageModel;
}
