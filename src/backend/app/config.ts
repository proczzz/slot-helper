import type z from 'zod';
import { AiStateSchema, type AiState, type AiStateStore } from '../adapter/ai/types.ts';
import { type TokenStore } from '../adapter/scheduling/types.ts';
import type { ConfigKey, ConfigRepository } from '../repository/types.ts';

// 把 key 綁死在 ai-state 的 ConfigRepository,對標 createTokenStore
export function createAiStateStore(
  configRepository: ConfigRepository,
  onChange: () => void, // 候選清單要重算
): AiStateStore {
  return {
    get() {
      return loadAiState(configRepository);
    },

    async demote(name, reason) {
      const current = await loadAiState(configRepository);
      if (current.some((item) => item.name === name)) return; // 已經降級過

      await saveAiState(configRepository, [...current, { name, reason, at: Date.now() }]);
      onChange();
    },

    async restore(name) {
      const current = await loadAiState(configRepository);
      await saveAiState(
        configRepository,
        current.filter((item) => item.name !== name),
      );
      onChange();
    },
  };
}

function saveAiState(configRepository: ConfigRepository, state: AiState): Promise<void> {
  return configRepository.set('ai-state', JSON.stringify(state));
}

// 供應商自己更新的狀態存在獨立的一列，避免管理員更新設定時覆蓋token
export function createTokenStore(configRepository: ConfigRepository): TokenStore {
  return {
    get() {
      return configRepository.get('scheduling-state');
    },
    set(value) {
      return configRepository.set('scheduling-state', value);
    },
    clear() {
      return configRepository.remove('scheduling-state');
    },
  };
}

function loadAiState(configRepository: ConfigRepository): Promise<AiState> {
  return loadSection(configRepository, 'ai-state', AiStateSchema, []);
}

// 沒設定或格式錯誤都回 fallback，系統要能在設定不全時啟動
async function loadSection<T, F>(
  configRepository: ConfigRepository,
  key: ConfigKey,
  schema: z.ZodType<T>,
  fallback: F,
): Promise<T | F> {
  const raw = await configRepository.get(key);
  if (!raw) return fallback;

  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    console.error(`${key} 設定格式錯誤，視為未設定`);
    return fallback;
  }
}
