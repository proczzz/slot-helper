import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelProvider } from './types.ts';

// NVIDIA 沒有專屬套件,它的推論端點是 OpenAI 相容的
const BASE_URL = 'https://integrate.api.nvidia.com/v1';

export const nvidiaProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const nvidia = createOpenAICompatible({
      name: 'nvidia',
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return nvidia.chatModel(model);
  },
};
