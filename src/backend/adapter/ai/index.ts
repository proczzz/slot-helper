import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogle } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getSupportedProviders, listModels, type Provider } from 'llm-lister';
import { ExpectedError } from '../../core/app-error.ts';
import { fromCompatible, fromFactory } from './factory.ts';
import type { ActiveModel, AiKey, LanguageModelProvider } from './types.ts';

const providers: Partial<Record<string, LanguageModelProvider>> = {
  // 官方套件
  anthropic: fromFactory(createAnthropic),
  deepseek: fromFactory(createDeepSeek),
  google: fromFactory(createGoogle),
  groq: fromFactory(createGroq),
  openai: fromFactory(createOpenAI),
  xai: fromFactory(createXai),
  // 社區套件
  openrouter: fromFactory(createOpenRouter),
  //OpenAI 相容套件(缺專屬套件)
  nvidia: fromCompatible('nvidia', 'https://integrate.api.nvidia.com/v1'),
};

// 目前只用第一組 active,多組備援之後再做
export function createLanguageModel(keys: AiKey[]): ActiveModel | null {
  const key = keys.find((item) => item.usage === 'active');
  if (!key) return null;

  const provider = providers[key.provider];
  if (!provider) return null;

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
