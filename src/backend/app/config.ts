import z from 'zod';
import {
  AiConfigSchema,
  AiStateSchema,
  type AiKey,
  type AiState,
  type AiStateStore,
} from '../adapter/ai/types.ts';
import { LineConfigSchema, type LineConfig } from '../adapter/line/types.ts';
import { GoogleCalendarSettingsSchema } from '../adapter/scheduling/google-calendar.ts';
import { providers } from '../adapter/scheduling/index.ts';
import {
  OutlookOauthSchema,
  type OutlookOauthSettings,
} from '../adapter/scheduling/outlook-oauth.ts';
import { OutlookSettingsSchema } from '../adapter/scheduling/outlook.ts';
import {
  SchedulingSelectionSchema,
  type SchedulingConfig,
  type TokenStore,
} from '../adapter/scheduling/types.ts';
import { TelegramConfigSchema, type TelegramConfig } from '../adapter/telegram/types.ts';
import { WhatsappConfigSchema, type WhatsappConfig } from '../adapter/whatsapp/types.ts';
import { ShopConfigSchema, type ShopConfig } from '../core/shop-config.ts';
import { SystemConfigSchema } from '../core/system-config.ts';
import { googleCalendarConfigMapper } from '../model/dto/google-calendar.ts';
import { lineConfigMapper } from '../model/dto/line.ts';
import { outlookConfigMapper } from '../model/dto/outlook.ts';
import { systemConfigMapper } from '../model/dto/system.ts';
import { telegramConfigMapper } from '../model/dto/telegram.ts';
import type { ConfigMapper } from '../model/dto/types.ts';
import { whatsappConfigMapper } from '../model/dto/whatsapp.ts';
import type { ConfigKey, ConfigRepository } from '../repository/types.ts';

// [白名單]後台可寫入的配置，scheduling-state 資料不在其中(禁止寫入)
export const SECTION_SCHEMAS: Partial<Record<ConfigKey, z.ZodType>> = {
  system: SystemConfigSchema,
  shop: ShopConfigSchema,
  ai: AiConfigSchema,
  scheduling: SchedulingSelectionSchema,
  'google-calendar': GoogleCalendarSettingsSchema,
  outlook: OutlookSettingsSchema,
  line: LineConfigSchema,
  telegram: TelegramConfigSchema,
  whatsapp: WhatsappConfigSchema,
};

// 有 mapper 的區塊由它決定怎麼綁與怎麼顯示;沒有的原樣存取
export const SECTION_MAPPERS: Partial<Record<ConfigKey, ConfigMapper>> = {
  system: systemConfigMapper,
  'google-calendar': googleCalendarConfigMapper,
  outlook: outlookConfigMapper,
  line: lineConfigMapper,
  telegram: telegramConfigMapper,
  whatsapp: whatsappConfigMapper,
};

export function loadAiKeys(configRepository: ConfigRepository): Promise<AiKey[]> {
  return loadSection(configRepository, 'ai', AiConfigSchema, []);
}

export function loadAiState(configRepository: ConfigRepository): Promise<AiState> {
  return loadSection(configRepository, 'ai-state', AiStateSchema, []);
}

// 把 key 綁死在 ai-state 的 ConfigRepository,對標 createTokenStore
export function createAiStateStore(configRepository: ConfigRepository): AiStateStore {
  return {
    get() {
      return loadAiState(configRepository);
    },

    async demote(name, reason) {
      const current = await loadAiState(configRepository);
      if (current.some((item) => item.name === name)) return; // 已經降級過

      await saveAiState(configRepository, [...current, { name, reason, at: Date.now() }]);
    },

    async restore(name) {
      const current = await loadAiState(configRepository);
      await saveAiState(
        configRepository,
        current.filter((item) => item.name !== name),
      );
    },
  };
}

function saveAiState(configRepository: ConfigRepository, state: AiState): Promise<void> {
  return configRepository.set('ai-state', JSON.stringify(state));
}

export function loadLineConfig(configRepository: ConfigRepository): Promise<LineConfig | null> {
  return loadSection(configRepository, 'line', LineConfigSchema, null);
}

export function loadWhatsappConfig(
  configRepository: ConfigRepository,
): Promise<WhatsappConfig | null> {
  return loadSection(configRepository, 'whatsapp', WhatsappConfigSchema, null);
}

export async function loadSchedulingConfig(
  configRepository: ConfigRepository,
): Promise<SchedulingConfig | null> {
  const selection = await loadSection(
    configRepository,
    'scheduling',
    SchedulingSelectionSchema,
    null,
  );
  if (!selection?.provider) return null;

  // 指標指到不存在的供應商就當沒設定
  if (!providers[selection.provider]) {
    console.error(`未知的日曆供應商: ${selection.provider}`);
    return null;
  }

  const raw = await configRepository.get(selection.provider as ConfigKey);
  if (!raw) return null;

  return { provider: selection.provider, settings: JSON.parse(raw) };
}

// 授權流程要讀 outlook 那一列,而且此時 calendarId 還是空的,
// 所以用只要求三個欄位的 OauthSchema 驗(object schema 會剝掉 calendarId)
export function loadOutlookSettings(
  configRepository: ConfigRepository,
): Promise<OutlookOauthSettings | null> {
  return loadSection(configRepository, 'outlook', OutlookOauthSchema, null);
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

export function loadTelegramConfig(
  configRepository: ConfigRepository,
): Promise<TelegramConfig | null> {
  return loadSection(configRepository, 'telegram', TelegramConfigSchema, null);
}

export function loadShopSettings(configRepository: ConfigRepository): Promise<ShopConfig> {
  return loadSection(configRepository, 'shop', ShopConfigSchema, ShopConfigSchema.parse({}));
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
