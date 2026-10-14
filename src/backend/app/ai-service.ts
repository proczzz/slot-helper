import { listAvailableModels } from '../adapter/ai/index.ts';
import type { AiState, AiStateStore } from '../adapter/ai/types.ts';
import { ExpectedError } from '../core/app-error.ts';
import type { ConfigRepository } from '../repository/types.ts';
import { loadAiKeys } from './config.ts';

export interface AiService {
  listModels(request: { provider: string; apiKey?: string; name?: string }): Promise<string[]>;
  demotions(): Promise<AiState>;
  restore(name: string): Promise<void>;
}

export function createAiService(
  configRepository: ConfigRepository, // repository
  aiState: AiStateStore, // service
): AiService {
  return {
    async listModels({ provider, apiKey, name }) {
      let key = apiKey;

      // 前端手上只有遮罩時會送 name，由後端自己讀出那把 key
      if (!key) {
        const keys = await loadAiKeys(configRepository);
        key = keys.find((item) => item.name === name)?.apiKey;
      }

      if (!key) throw new ExpectedError('找不到這組 API key，請先儲存設定或重新輸入');

      return listAvailableModels(provider, key);
    },

    demotions() {
      return aiState.get();
    },

    restore(name) {
      return aiState.restore(name);
    },
  };
}
