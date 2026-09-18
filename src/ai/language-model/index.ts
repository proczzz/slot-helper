import type { LanguageModel } from 'ai';
import { listModels as llmListerListModels, getSupportedProviders } from 'llm-lister';
import type { Provider } from 'llm-lister';
import { deepSeekProvider } from './deepseek.ts';
import { anthropicProvider } from './anthropic.ts';
import type { LanguageModelProvider, LanguageModelProviderEnv, ModelInfo } from './types.ts';

const providers: Record<string, LanguageModelProvider> = {
  deepseek: deepSeekProvider,
  anthropic: anthropicProvider,
};

// 供應商名稱 -> 對應的環境變數欄位名稱
const API_KEY_ENV_MAP: Record<string, keyof LanguageModelProviderEnv> = {
  deepseek: 'DEEPSEEK_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

function getProvider(env: LanguageModelProviderEnv): LanguageModelProvider {
  const provider = providers[env.AI_PROVIDER ?? ''];
  if (!provider) {
    throw new Error(`Unsupported or missing AI_PROVIDER: "${env.AI_PROVIDER}"`);
  }
  return provider;
}

function getApiKey(env: LanguageModelProviderEnv): string {
  const envKeyName = API_KEY_ENV_MAP[env.AI_PROVIDER ?? ''];
  const key = envKeyName ? env[envKeyName] : undefined;
  if (!key) {
    throw new Error(`API key is required to list ${env.AI_PROVIDER} models`);
  }
  return key;
}

export function createLanguageModel(env: LanguageModelProviderEnv): LanguageModel {
  return getProvider(env).createModel(env);
}

export function listLanguageModels(env: LanguageModelProviderEnv): Promise<ModelInfo[]> {
  const provider = env.AI_PROVIDER as Provider;
  const apiKey = getApiKey(env);

  const supported = getSupportedProviders();
  if (!supported.includes(provider)) {
    throw new Error(
      `llm-lister does not support listing models for "${provider}" yet. Currently supported: ${supported.join(', ')}`,
    );
  }

  return llmListerListModels(provider, apiKey);
}
