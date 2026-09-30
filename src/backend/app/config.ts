import z from 'zod';
import { AiKeysSchema, type AiKey } from '../ai/language-model/types.ts';
import { LineConfigSchema, type LineConfig } from '../channels/line/types.ts';
import { ShopSettingsSchema, type ShopSettings } from '../core/model/shop-settings.ts';
import { SchedulingConfigSchema, type SchedulingConfig } from '../providers/scheduling/types.ts';
import type { ConfigKey, ConfigRepository } from '../repository/types.ts';

// [白名單]後台可寫入的配置，system 等內部資料不在其中
export const SECTION_SCHEMAS: Partial<Record<ConfigKey, z.ZodType>> = {
  ai: AiKeysSchema,
  line: LineConfigSchema,
  scheduling: SchedulingConfigSchema,
  shop: ShopSettingsSchema,
};

const SystemConfigSchema = z.object({
  jwtSecret: z.string(),
  initializedAt: z.string(),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

export function loadAiKeys(configRepository: ConfigRepository): Promise<AiKey[]> {
  return loadSection(configRepository, 'ai', AiKeysSchema, []);
}

export function loadLineConfig(configRepository: ConfigRepository): Promise<LineConfig | null> {
  return loadSection(configRepository, 'line', LineConfigSchema, null);
}

export function loadSchedulingConfig(
  configRepository: ConfigRepository,
): Promise<SchedulingConfig | null> {
  return loadSection(configRepository, 'scheduling', SchedulingConfigSchema, null);
}

export function loadShopSettings(configRepository: ConfigRepository): Promise<ShopSettings> {
  return loadSection(configRepository, 'shop', ShopSettingsSchema, {
    instructions: '',
    businessHours: {},
  });
}

export function loadSystemConfig(configRepository: ConfigRepository): Promise<SystemConfig | null> {
  return loadSection(configRepository, 'system', SystemConfigSchema, null);
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
