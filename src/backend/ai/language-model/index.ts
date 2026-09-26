import type { LanguageModel } from 'ai';
import { anthropicProvider } from './anthropic.ts';
import { deepSeekProvider } from './deepseek.ts';
import type { LanguageModelConfig, LanguageModelProvider } from './types.ts';

const providers: Partial<Record<string, LanguageModelProvider>> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

export function createLanguageModel(config: LanguageModelConfig): LanguageModel | null {
  const name = config.AI_PROVIDER ?? '';

  const provider = providers[name];
  if (!provider) return null;

  const apiKey = config[provider.apiKeyEnv];
  if (!apiKey) return null;

  console.log(`使用AI供應商: ${name}`);
  return provider.createModel(apiKey);
}
