import { getSupportedProviders, listModels, type Provider } from 'llm-lister';
import { ExpectedError } from '../../core/app-error.ts';
import { anthropicProvider } from './anthropic.ts';
import { deepSeekProvider } from './deepseek.ts';
import { googleProvider } from './google.ts';
import { groqProvider } from './groq.ts';
import { nvidiaProvider } from './nvidia.ts';
import { openAiProvider } from './openai.ts';
import { openRouterProvider } from './openrouter.ts';
import type { ActiveModel, AiKey, LanguageModelProvider } from './types.ts';

const providers: Partial<Record<string, LanguageModelProvider>> = {
  anthropic: anthropicProvider,
  deepseek: deepSeekProvider,
  google: googleProvider,
  groq: groqProvider,
  nvidia: nvidiaProvider,
  openai: openAiProvider,
  openrouter: openRouterProvider,
};

// 目前只用第一組,多組備援之後再做
export function createLanguageModel(keys: AiKey[]): ActiveModel | null {
  const key = keys[0];
  if (!key) return null;

  const provider = providers[key.provider];
  if (!provider) return null;

  console.log(`使用AI供應商: ${key.provider}`);
  return {
    model: provider.createModel(key.apiKey, key.model),
    provider: key.provider,
    modelName: key.model,
  };
}

// 列出可用llm
export async function listAvailableModels(provider: string, apiKey: string): Promise<string[]> {
  const supported = getSupportedProviders();
  if (!supported.includes(provider as Provider)) {
    throw new ExpectedError(`llm-lister 尚未支援 ${provider}，請手動輸入模型名稱`);
  }

  const models = await listModels(provider as Provider, apiKey);
  return models.map((model) => model.id);
}
