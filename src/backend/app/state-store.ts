import { AiStateSchema, type AiState, type AiStateStore } from '../adapter/ai/types.ts';
import type { TokenStore } from '../adapter/scheduling/types.ts';
import type { ConfigRepository } from '../repository/types.ts';

// 降級名單每次現讀,不走 properties 快照
export function createAiStateStore(
  configRepository: ConfigRepository,
  onChange: () => void, // 候選清單要重算
): AiStateStore {
  return {
    get: read,

    async demote(name, reason) {
      const current = await read();
      if (current.some((item) => item.name === name)) return; // 已經降級過

      await write([...current, { name, reason, at: Date.now() }]);
    },

    async restore(name) {
      const current = await read();
      await write(current.filter((item) => item.name !== name));
    },
  };

  async function read(): Promise<AiState> {
    const raw = await configRepository.get('ai-state');
    if (!raw) return [];

    try {
      return AiStateSchema.parse(JSON.parse(raw));
    } catch {
      console.error('ai-state 格式錯誤，視為沒有降級紀錄');
      return [];
    }
  }

  async function write(state: AiState): Promise<void> {
    await configRepository.set('ai-state', JSON.stringify(state));
    onChange();
  }
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
