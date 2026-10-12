import { createGroq } from '@ai-sdk/groq';
import type { LanguageModelProvider } from './types.ts';

export const groqProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const groq = createGroq({
      apiKey,
    });
    return groq(model);
  },
};
