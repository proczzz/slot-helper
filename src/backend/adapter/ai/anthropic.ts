import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelProvider } from './types.ts';

export const anthropicProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const anthropic = createAnthropic({ apiKey });
    return anthropic(model);
  },
};
