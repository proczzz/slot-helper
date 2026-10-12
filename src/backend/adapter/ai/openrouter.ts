import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModelProvider } from './types.ts';

export const openRouterProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const openrouter = createOpenRouter({
      apiKey,
    });
    return openrouter(model);
  },
};
