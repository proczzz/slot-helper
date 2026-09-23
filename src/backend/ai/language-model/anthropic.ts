import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelProvider } from './types.ts';

const ANTHROPIC_MODEL_ID = 'claude-sonnet-5';

export const anthropicProvider: LanguageModelProvider = {
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  createModel(apiKey: string) {
    const anthropic = createAnthropic({ apiKey });
    return anthropic(ANTHROPIC_MODEL_ID);
  },
};
