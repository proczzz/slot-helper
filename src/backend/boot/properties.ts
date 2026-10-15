import z from 'zod';
import { AiConfigSchema, AiStateSchema, type AiKey, type AiState } from '../adapter/ai/types.ts';
import { LineConfigSchema, type LineConfig } from '../adapter/line/types.ts';
import { providers } from '../adapter/scheduling/index.ts';
import {
  OutlookOauthSchema,
  type OutlookOauthSettings,
} from '../adapter/scheduling/outlook-oauth.ts';
import { SchedulingSelectionSchema, type SchedulingConfig } from '../adapter/scheduling/types.ts';
import { TelegramConfigSchema, type TelegramConfig } from '../adapter/telegram/types.ts';
import { WhatsappConfigSchema, type WhatsappConfig } from '../adapter/whatsapp/types.ts';
import { ShopConfigSchema, type ShopConfig } from '../model/shop-config.ts';
import { SystemConfigSchema, type SystemConfig } from '../model/system-config.ts';
import type { ConfigKey, ConfigRepository } from '../repository/types.ts';

// config 表的快照。欄位名對應 config 表的 key
export interface Properties {
  system: SystemConfig;
  shop: ShopConfig;
  ai: AiKey[];
  aiState: AiState;
  line: LineConfig | null;
  whatsapp: WhatsappConfig | null;
  telegram: TelegramConfig | null;
  scheduling: SchedulingConfig | null;
  outlook: OutlookOauthSettings | null;
}

type Rows = Map<ConfigKey, string>;

export async function loadProperties(configRepository: ConfigRepository): Promise<Properties> {
  const rows = await configRepository.getAll();

  return {
    system: read(rows, 'system', SystemConfigSchema, SystemConfigSchema.parse({})),
    shop: read(rows, 'shop', ShopConfigSchema, ShopConfigSchema.parse({})),
    ai: read(rows, 'ai', AiConfigSchema, []),
    aiState: read(rows, 'ai-state', AiStateSchema, []),
    line: read(rows, 'line', LineConfigSchema, null),
    whatsapp: read(rows, 'whatsapp', WhatsappConfigSchema, null),
    telegram: read(rows, 'telegram', TelegramConfigSchema, null),
    scheduling: readScheduling(rows),
    // 授權流程此時 calendarId 還是空的,所以用只要求三個欄位的 OauthSchema 驗
    outlook: read(rows, 'outlook', OutlookOauthSchema, null),
  };
}

function readScheduling(rows: Rows): SchedulingConfig | null {
  const selection = read(rows, 'scheduling', SchedulingSelectionSchema, null);
  if (!selection?.provider) return null;

  // 指標指到不存在的供應商就當沒設定
  if (!providers[selection.provider]) {
    console.error(`未知的日曆供應商: ${selection.provider}`);
    return null;
  }

  const raw = rows.get(selection.provider as ConfigKey);
  if (!raw) return null;

  return { provider: selection.provider, settings: JSON.parse(raw) };
}

// 沒設定或格式錯誤都回 fallback，系統要能在設定不全時啟動
function read<T, F>(rows: Rows, key: ConfigKey, schema: z.ZodType<T>, fallback: F): T | F {
  const raw = rows.get(key);
  if (!raw) return fallback;

  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    console.error(`${key} 設定格式錯誤，視為未設定`);
    return fallback;
  }
}
