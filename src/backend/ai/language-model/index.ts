import type { LanguageModel } from 'ai';
import { anthropicProvider } from './anthropic.ts';
import { deepSeekProvider } from './deepseek.ts';
import type { LanguageModelEnv, LanguageModelProvider } from './types.ts';

const providers: Partial<Record<string, LanguageModelProvider>> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

export function createLanguageModel(env: LanguageModelEnv): LanguageModel | null {
  const name = env.AI_PROVIDER ?? '';

  const provider = providers[name];
  if (!provider) return null;

  const apiKey = env[provider.apiKeyEnv];
  if (!apiKey) return null;

  console.log(`使用AI供應商: ${name}`);
  return provider.createModel(apiKey);
}
