import type { LanguageModel } from 'ai';
import { createDeepSeekModel } from './deepseek.ts';
import { createAnthropicModel } from './anthropic.ts';
import type { LanguageModelProviderEnv } from './types.ts';

export function createLanguageModel(env: LanguageModelProviderEnv): LanguageModel {
  switch (env.AI_PROVIDER) {
    case 'deepseek':
      return createDeepSeekModel(env);
    case 'anthropic':
      return createAnthropicModel(env);
    default:
      throw new Error(`Unsupported or missing AI_PROVIDER: "${env.AI_PROVIDER}"`);
  }
}
