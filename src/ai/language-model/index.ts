import type { LanguageModel } from 'ai';
import type { Provider } from 'llm-lister';
import { getSupportedProviders, listModels as llmListerListModels } from 'llm-lister';
import type { AppEnv } from '../../app/services.ts';
import { anthropicProvider } from './anthropic.ts';
import { deepSeekProvider } from './deepseek.ts';
import type { LanguageModelProvider, ModelInfo } from './types.ts';

const providers: Record<string, LanguageModelProvider> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

export function createLanguageModel(env: AppEnv): LanguageModel {
  const provider = getProvider(env);
  return provider.createModel(getApiKey(env, provider));
}

export function listLanguageModels(env: AppEnv): Promise<ModelInfo[]> {
  const provider = env.AI_PROVIDER as Provider;
  const apiKey = getApiKey(env, getProvider(env));

  const supported = getSupportedProviders();
  if (!supported.includes(provider)) {
    throw new Error(
      `llm-lister does not support listing models for "${provider}" yet. Currently supported: ${supported.join(', ')}`,
    );
  }

  return llmListerListModels(provider, apiKey);
}

function getProvider(env: AppEnv): LanguageModelProvider {
  const provider = providers[env.AI_PROVIDER ?? ''];
  if (!provider) {
    throw new Error(`Unsupported or missing AI_PROVIDER: "${env.AI_PROVIDER}"`);
  }
  console.log(`使用AI供應商: ${env.AI_PROVIDER}`);
  return provider;
}

function getApiKey(env: AppEnv, provider: LanguageModelProvider): string {
  const key = env[provider.apiKeyEnv];
  if (!key) {
    throw new Error(`${provider.apiKeyEnv} is required when AI_PROVIDER=${env.AI_PROVIDER}`);
  }
  return key;
}
