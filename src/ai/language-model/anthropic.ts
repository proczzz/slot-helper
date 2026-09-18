import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelProvider, LanguageModelProviderEnv, ModelInfo } from './types.ts';

export const anthropicProvider: LanguageModelProvider = {
  createModel(env: LanguageModelProviderEnv) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
    }
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return anthropic('claude-sonnet-5');
  },

  // TODO: 目前用固定假資料頂著,之後要換成真實打 GET https://api.anthropic.com/v1/models
  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-sonnet-5', provider: 'anthropic' },
      { id: 'claude-opus-5', provider: 'anthropic' },
    ];
  },
};
