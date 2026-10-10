import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelProvider } from './types.ts';

// OpenRouter 沒有專屬套件,它的推論端點是 OpenAI 相容的
const BASE_URL = 'https://openrouter.ai/api/v1';

export const openRouterProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const openRouter = createOpenAICompatible({
      name: 'openrouter',
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return openRouter.chatModel(model);
  },
};
