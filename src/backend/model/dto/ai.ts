import { z } from 'zod';

export const ListModelsSchema = z.object({
  provider: z.string().min(1, '請選擇供應商'),
  apiKey: z.string().min(1, '請輸入 API key'),
});
