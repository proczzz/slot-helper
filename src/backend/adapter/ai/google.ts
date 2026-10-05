import { createGoogle } from '@ai-sdk/google';
import type { LanguageModelProvider } from './types';

export const googleProvider: LanguageModelProvider = {
  createModel(apiKey, model) {
    const google = createGoogle({ apiKey });
    return google(model);
  },
};
