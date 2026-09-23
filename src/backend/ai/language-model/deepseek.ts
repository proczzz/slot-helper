import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModelProvider } from './types.ts';

const DEEPSEEK_MODEL_ID = 'deepseek-flash';

export const deepSeekProvider: LanguageModelProvider = {
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  createModel(apiKey: string) {
    const deepseek = createDeepSeek({ apiKey });
    return deepseek(DEEPSEEK_MODEL_ID);
  },
};
