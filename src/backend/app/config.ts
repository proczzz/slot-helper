import z from 'zod';
import { AiConfigSchema, type AiKey } from '../adapter/ai/types.ts';
import { LineConfigSchema, type LineConfig } from '../adapter/line/types.ts';
import { GoogleCalendarSettingsSchema } from '../adapter/scheduling/google-calendar.ts';
import { providers } from '../adapter/scheduling/index.ts';
import { SchedulingSelectionSchema, type SchedulingConfig } from '../adapter/scheduling/types.ts';
import { TelegramConfigSchema, type TelegramConfig } from '../adapter/telegram/types.ts';
import { WhatsappConfigSchema, type WhatsappConfig } from '../adapter/whatsapp/types.ts';
import { ShopConfigSchema, type ShopConfig } from '../core/shop-config.ts';
import { googleCalendarConfigMapper } from '../model/dto/google-calendar.ts';
import { lineConfigMapper } from '../model/dto/line.ts';
import { telegramConfigMapper } from '../model/dto/telegram.ts';
import type { ConfigMapper } from '../model/dto/types.ts';
import { whatsappConfigMapper } from '../model/dto/whatsapp.ts';
import type { ConfigKey, ConfigRepository } from '../repository/types.ts';

// [白名單]後台可寫入的配置，system 等內部資料不在其中
export const SECTION_SCHEMAS: Partial<Record<ConfigKey, z.ZodType>> = {
  shop: ShopConfigSchema,
  ai: AiConfigSchema,
  scheduling: SchedulingSelectionSchema,
  'google-calendar': GoogleCalendarSettingsSchema,
  line: LineConfigSchema,
  telegram: TelegramConfigSchema,
  whatsapp: WhatsappConfigSchema,
};

// 有 mapper 的區塊由它決定怎麼綁與怎麼顯示;沒有的原樣存取
export const SECTION_MAPPERS: Partial<Record<ConfigKey, ConfigMapper>> = {
  'google-calendar': googleCalendarConfigMapper,
  line: lineConfigMapper,
  telegram: telegramConfigMapper,
  whatsapp: whatsappConfigMapper,
};

export function loadAiKeys(configRepository: ConfigRepository): Promise<AiKey[]> {
  return loadSection(configRepository, 'ai', AiConfigSchema, []);
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
