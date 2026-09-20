import { createAnthropic } from '@ai-sdk/anthropic';
import type { AppEnv } from '../../app/services.ts';
import type { LanguageModelProvider } from './types.ts';

export const anthropicProvider: LanguageModelProvider = {
  createModel(env: AppEnv) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
    }
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return anthropic('claude-sonnet-5');
  },
};
