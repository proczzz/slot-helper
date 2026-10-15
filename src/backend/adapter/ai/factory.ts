import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { LanguageModelProvider } from './types';

// 各家套件的形狀一致:工廠收 apiKey,回傳的物件可以直接當函式呼叫、收模型名稱
type ProviderFactory = (options: { apiKey: string }) => (model: string) => LanguageModel;

// 有專屬套件的(官方或社區)
export function fromFactory(create: ProviderFactory): LanguageModelProvider {
  return {
    createModel: (apiKey, model) => create({ apiKey })(model),
  };
}

// 沒有專屬套件，但端點是 OpenAI 相容的
export function fromCompatible(name: string, baseURL: string): LanguageModelProvider {
  return {
    createModel: (apiKey, model) =>
      createOpenAICompatible({
        name,
        baseURL,
        headers: { Authorization: `Bearer ${apiKey}` },
      }).chatModel(model),
  };
}
