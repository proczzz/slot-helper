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
import type { ActiveModel, AiKey, AiUsage, LanguageModelProvider } from './types.ts';

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

// 依設定的順序建出候選模型,順序就是備援的先後
export function createLanguageModels(
  keys: AiKey[],
  usage: AiUsage,
  demoted: string[],
): ActiveModel[] {
  const models: ActiveModel[] = [];

  for (const key of keys) {
    if (key.usage !== usage) continue;

    const provider = providers[key.provider];
    if (!provider) continue; // 供應商名稱不認得,當成沒設定

    models.push({
      name: key.name,
      model: provider.createModel(key.apiKey, key.model),
      provider: key.provider,
      modelName: key.model,
    });
  }

  return models;
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
