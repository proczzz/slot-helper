import type { LanguageModel } from 'ai';
import { anthropicProvider } from './anthropic.ts';
import { deepSeekProvider } from './deepseek.ts';
import type { LanguageModelEnv, LanguageModelProvider } from './types.ts';

const providers: Record<string, LanguageModelProvider> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

export function createLanguageModel(env: LanguageModelEnv): LanguageModel {
  const name = env.AI_PROVIDER ?? '';

  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unsupported or missing AI_PROVIDER: "${env.AI_PROVIDER}"`);
  }

  const apiKey = env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is required when AI_PROVIDER=${name}`);
  }

  console.log(`使用AI供應商: ${name}`);
  return provider.createModel(apiKey);
}
