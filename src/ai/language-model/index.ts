import type { LanguageModel } from 'ai';
import { deepSeekProvider } from './deepseek.ts';
import { anthropicProvider } from './anthropic.ts';
import type { LanguageModelProvider, LanguageModelProviderEnv } from './types.ts';

const providers: Record<string, LanguageModelProvider> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

function getProvider(env: LanguageModelProviderEnv): LanguageModelProvider {
  const provider = providers[env.AI_PROVIDER ?? ''];
  if (!provider) {
    throw new Error(`Unsupported or missing AI_PROVIDER: "${env.AI_PROVIDER}"`);
  }
  return provider;
}

export function createLanguageModel(env: LanguageModelProviderEnv): LanguageModel {
  return getProvider(env).createModel(env);
}
