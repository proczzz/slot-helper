import type { LanguageModel } from 'ai';
import { anthropicProvider } from './anthropic.ts';
import { deepSeekProvider } from './deepseek.ts';
import type { AiKey, LanguageModelProvider } from './types.ts';

const providers: Partial<Record<string, LanguageModelProvider>> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

// 目前只用第一組,多組備援之後再做
export function createLanguageModel(keys: AiKey[]): LanguageModel | null {
  const key = keys[0];
  if (!key) return null;

  const provider = providers[key.provider];
  if (!provider) return null;

  console.log(`使用AI供應商: ${key.provider}`);
  return provider.createModel(key.apiKey, key.model);
}
