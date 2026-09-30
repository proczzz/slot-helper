import z from 'zod';
import { AiKeysSchema, type AiKey } from '../ai/language-model/types.ts';
import { LineConfigSchema, type LineConfig } from '../channels/line/types.ts';
import { ShopSettingsSchema, type ShopSettings } from '../core/model/shop-settings.ts';
import { SchedulingConfigSchema, type SchedulingConfig } from '../providers/scheduling/types.ts';
import type { ConfigRepository } from '../repository/types.ts';

// config 表中的 key
export type ConfigKey = 'system' | 'ai' | 'shop' | 'line' | 'scheduling';

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

export async function loadSystemConfig(
  configRepository: ConfigRepository,
): Promise<SystemConfig | null> {
  const raw = await configRepository.get('system');
  if (!raw) return null;

  try {
    return SystemConfigSchema.parse(JSON.parse(raw));
  } catch {
    console.error('system 設定格式錯誤');
    return null;
  }
}

export async function loadAiKeys(configRepository: ConfigRepository): Promise<AiKey[]> {
  const raw = await configRepository.get('ai');
  if (!raw) return [];

  try {
    return AiKeysSchema.parse(JSON.parse(raw));
  } catch {
    console.error('ai 設定格式錯誤，視為未設定');
    return [];
  }
}

export async function loadLineConfig(
  configRepository: ConfigRepository,
): Promise<LineConfig | null> {
  const raw = await configRepository.get('line');
  if (!raw) return null;

  try {
    return LineConfigSchema.parse(JSON.parse(raw));
  } catch {
    console.error('line 設定格式錯誤，視為未設定');
    return null;
  }
}

const EMPTY_SHOP: ShopSettings = { instructions: '', businessHours: {} };

export async function loadShopSettings(configRepository: ConfigRepository): Promise<ShopSettings> {
  const raw = await configRepository.get('shop');
  if (!raw) return EMPTY_SHOP;

  try {
    return ShopSettingsSchema.parse(JSON.parse(raw));
  } catch {
    console.error('shop 設定格式錯誤，視為未設定');
    return EMPTY_SHOP;
  }
}

export async function loadSchedulingConfig(
  configRepository: ConfigRepository,
): Promise<SchedulingConfig | null> {
  const raw = await configRepository.get('scheduling');
  if (!raw) return null;

  try {
    return SchedulingConfigSchema.parse(JSON.parse(raw));
  } catch {
    console.error('scheduling 設定格式錯誤，視為未設定');
    return null;
  }
}
