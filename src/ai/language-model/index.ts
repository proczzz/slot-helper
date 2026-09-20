import type { LanguageModel } from 'ai';
import type { ModelInfo, Provider } from 'llm-lister';
import { getSupportedProviders, listModels } from 'llm-lister';
import { anthropicProvider } from './anthropic.ts';
import { deepSeekProvider } from './deepseek.ts';
import type { LanguageModelEnv, LanguageModelProvider } from './types.ts';

const providers: Record<string, LanguageModelProvider> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

export function createLanguageModel(env: LanguageModelEnv): LanguageModel {
  const { name, provider, apiKey } = resolveProvider(env);
  console.log(`使用AI供應商: ${name}`);
  return provider.createModel(apiKey);
}

export function listLanguageModels(name: string, apiKey: string): Promise<ModelInfo[]> {
  const supported = getSupportedProviders();
  if (!supported.includes(name as Provider)) {
    throw new Error(
      `llm-lister does not support listing models for "${name}" yet. Currently supported: ${supported.join(', ')}`,
    );
  }
  return listModels(name as Provider, apiKey);
}

export interface ResolvedProvider {
  name: string; // 供應商名稱
  provider: LanguageModelProvider; // 實例
  apiKey: string;
}

export function resolveProvider(env: LanguageModelEnv): ResolvedProvider {
  const name = env.AI_PROVIDER ?? '';

  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unsupported or missing AI_PROVIDER: "${env.AI_PROVIDER}"`);
  }

  const apiKey = env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is required when AI_PROVIDER=${name}`);
  }
  return { name, provider, apiKey };
}
