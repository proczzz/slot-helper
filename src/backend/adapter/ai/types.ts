import type { LanguageModel } from 'ai';
import z from 'zod';

// 存 config table
export const AiConfigSchema = z.array(
  z.object({
    name: z.string().min(1, '請輸入名稱'),
    provider: z.string().min(1, '請選擇供應商'),
    apiKey: z.string().min(1, '請輸入 API key'),
    model: z.string().min(1, '請輸入模型名稱'),
  }),
);

export type AiConfig = z.infer<typeof AiConfigSchema>;
export type AiKey = z.infer<typeof AiConfigSchema>[number];

// 存 service
export interface ActiveModel {
  model: LanguageModel;
  provider: string;
  modelName: string; // 存進對話紀錄時分辨是哪個 llm 回覆使用
}

export interface LanguageModelProvider {
  createModel(apiKey: string, model: string): LanguageModel;
}
