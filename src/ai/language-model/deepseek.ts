import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModelProvider, LanguageModelProviderEnv, ModelInfo } from './types.ts';

// --- http api 維護區 ---
const DEEPSEEK_MODEL_ID = 'deepseek-flash';
const DEEPSEEK_MODELS_URL = 'https://api.deepseek.com/models';

interface DeepSeekModelsResponse {
  data: { id: string }[];
}
// --- http api 維護區 ---

export const deepSeekProvider: LanguageModelProvider = {
  createModel(env: LanguageModelProviderEnv) {
    if (!env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek');
    }
    const deepseek = createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY });
    return deepseek(DEEPSEEK_MODEL_ID);
  },

  async listModels(env: LanguageModelProviderEnv): Promise<ModelInfo[]> {
    if (!env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is required to list DeepSeek models');
    }
    const response = await fetch(DEEPSEEK_MODELS_URL, {
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to list DeepSeek models: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as DeepSeekModelsResponse;
    return body.data.map((model) => ({ id: model.id, provider: 'deepseek' }));
  },
};
