import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelProvider } from './types.ts';

// Groq 的推論端點是 OpenAI 相容的
const BASE_URL = 'https://api.groq.com/openai/v1';

export const groqProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const groq = createOpenAICompatible({
      name: 'groq',
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return groq.chatModel(model);
  },
};
