import z from 'zod';
import { AiKeysSchema, type AiKey } from '../ai/language-model/types.ts';
import { LineConfigSchema, type LineConfig } from '../channels/line/types.ts';
import type { BusinessHours, ShopSettings } from '../core/model/shop-settings.ts';
import { SchedulingConfigSchema, type SchedulingConfig } from '../providers/scheduling/types.ts';
import type { ConfigRepository } from '../repository/types.ts';

export interface AppConfig {
  SYSTEM_PROMPT?: string;
  BUSINESS_HOURS?: string;
}

// 這些設定存在 db config 表，由後台填寫
export const CONFIG_KEYS = [
  'SCHEDULING_PROVIDER',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CALENDAR_ID',

  'SYSTEM_PROMPT',
  'BUSINESS_HOURS',
] as const;

export const SYSTEM_CONFIG_KEY = 'system';
export const AI_CONFIG_KEY = 'ai';
export const LINE_CONFIG_KEY = 'line';
export const SCHEDULING_CONFIG_KEY = 'scheduling';

// 抓資料庫所有配置
export async function loadAppConfig(configRepository: ConfigRepository): Promise<AppConfig> {
  const entries = await Promise.all(
    CONFIG_KEYS.map(async (key) => [key, await configRepository.get(key)] as const),
  );
  return Object.fromEntries(entries.filter(([, value]) => value !== null));
}

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

export function toShopSettings(config: AppConfig): ShopSettings {
  let businessHours: BusinessHours = {};
  try {
    businessHours = config.BUSINESS_HOURS ? JSON.parse(config.BUSINESS_HOURS) : {};
  } catch {
    console.error('BUSINESS_HOURS 格式錯誤，視為未設定');
  }

  return {
    instructions: config.SYSTEM_PROMPT ?? '',
    businessHours,
  };
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
