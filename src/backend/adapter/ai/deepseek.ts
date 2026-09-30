import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModelProvider } from './types.ts';

export const deepSeekProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const deepseek = createDeepSeek({ apiKey });
    return deepseek(model);
  },
};
