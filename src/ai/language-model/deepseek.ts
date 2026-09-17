import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModelProvider, LanguageModelProviderEnv } from './types.ts';

export const deepSeekProvider: LanguageModelProvider = {
  createModel(env: LanguageModelProviderEnv) {
    if (!env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek');
    }
    const deepseek = createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY });
    return deepseek('deepseek-flash');
  },
};
