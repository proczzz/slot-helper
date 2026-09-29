import { AiKeysSchema, type AiKey } from '../ai/language-model/types.ts';
import type { LineConfig } from '../channels/line/types.ts';
import type { BusinessHours, ShopSettings } from '../core/model/shop-settings.ts';
import type { SchedulingProviderConfig } from '../providers/scheduling/types.ts';
import type { ConfigRepository } from '../repository/types.ts';

export interface AppConfig extends SchedulingProviderConfig, LineConfig {
  AI_KEYS?: string;
  SYSTEM_PROMPT?: string;
  BUSINESS_HOURS?: string;
  ADMIN_JWT_SECRET?: string;
}

// 這些設定存在 db config 表，由後台填寫
export const CONFIG_KEYS = [
  'SCHEDULING_PROVIDER',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CALENDAR_ID',

  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',

  'SYSTEM_PROMPT',
  'BUSINESS_HOURS',

  'ADMIN_JWT_SECRET', // 簽/驗 後臺帳號 jwt 的 HS256 key
] as const;

export const AI_CONFIG_KEY = 'ai';

// 抓資料庫所有配置
export async function loadAppConfig(configRepository: ConfigRepository): Promise<AppConfig> {
  const entries = await Promise.all(
    CONFIG_KEYS.map(async (key) => [key, await configRepository.get(key)] as const),
  );
  return Object.fromEntries(entries.filter(([, value]) => value !== null));
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
