import type { LanguageModel } from 'ai';
import z from 'zod';

export interface LanguageModelProvider {
  createModel(apiKey: string, model: string): LanguageModel;
}

export const AiKeysSchema = z.array(
  z.object({
    name: z.string().min(1, '請輸入名稱'),
    provider: z.string().min(1, '請選擇供應商'),
    apiKey: z.string().min(1, '請輸入 API key'),
    model: z.string().min(1, '請輸入模型名稱'),
  }),
);

export type AiKey = z.infer<typeof AiKeysSchema>[number];
