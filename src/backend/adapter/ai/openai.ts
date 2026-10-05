import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelProvider } from './types.ts';

export const openAiProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const openai = createOpenAI({ apiKey });
    return openai(model);
  },
};
