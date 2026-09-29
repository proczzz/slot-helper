import z from 'zod';
import { AiKeysSchema, type AiKey } from '../ai/language-model/types.ts';
import { LineConfigSchema, type LineConfig } from '../channels/line/types.ts';
import { SchedulingConfigSchema, type SchedulingConfig } from '../providers/scheduling/types.ts';
import type { ConfigRepository } from '../repository/types.ts';
import { ShopSettingsSchema, type ShopSettings } from '../core/model/shop-settings.ts';

export const SYSTEM_CONFIG_KEY = 'system';
export const AI_CONFIG_KEY = 'ai';
export const SHOP_CONFIG_KEY = 'shop';
export const LINE_CONFIG_KEY = 'line';
export const SCHEDULING_CONFIG_KEY = 'scheduling';

// 後台可讀寫的區塊，system 刻意不在其中
export const SECTION_KEYS: Record<string, string> = {
  ai: AI_CONFIG_KEY,
  line: LINE_CONFIG_KEY,
  scheduling: SCHEDULING_CONFIG_KEY,
  shop: SHOP_CONFIG_KEY,
};

const SystemConfigSchema = z.object({
  jwtSecret: z.string(),
  initializedAt: z.string(),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

export async function loadSystemConfig(
  configRepository: ConfigRepository,
): Promise<SystemConfig | null> {
  const raw = await configRepository.get(SYSTEM_CONFIG_KEY);
  if (!raw) return null;

  try {
    return SystemConfigSchema.parse(JSON.parse(raw));
  } catch {
    console.error('system 設定格式錯誤');
    return null;
  }
}

export async function loadAiKeys(configRepository: ConfigRepository): Promise<AiKey[]> {
  const raw = await configRepository.get(AI_CONFIG_KEY);
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
  const raw = await configRepository.get(LINE_CONFIG_KEY);
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
  const raw = await configRepository.get(SHOP_CONFIG_KEY);
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
  const raw = await configRepository.get(SCHEDULING_CONFIG_KEY);
  if (!raw) return null;

  try {
    return SchedulingConfigSchema.parse(JSON.parse(raw));
  } catch {
    console.error('scheduling 設定格式錯誤，視為未設定');
    return null;
  }
}
