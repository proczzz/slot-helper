import type { AdminEnv } from '../admin/types.ts';
import type { LanguageModelConfig } from '../ai/language-model/types.ts';
import type { LineConfig } from '../channels/line/types.ts';
import type { BusinessHours, ConfigStore, ShopSettings } from '../core/types.ts';
import type { SchedulingProviderConfig } from '../providers/scheduling/types.ts';

export interface AppConfig
  extends LanguageModelConfig, SchedulingProviderConfig, LineConfig, AdminEnv {
  SYSTEM_PROMPT?: string;
  BUSINESS_HOURS?: string;
}

// 這些設定存在 db config 表，由後台填寫
export const CONFIG_KEYS = [
  'AI_PROVIDER',
  'DEEPSEEK_API_KEY',
  'ANTHROPIC_API_KEY',

  'SCHEDULING_PROVIDER',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_CALENDAR_ID',

  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',

  'SYSTEM_PROMPT',
  'BUSINESS_HOURS',
] as const;

// 抓資料庫所有配置
export async function loadAppConfig(configStore: ConfigStore): Promise<AppConfig> {
  const entries = await Promise.all(
    CONFIG_KEYS.map(async (key) => [key, await configStore.get(key)] as const),
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
