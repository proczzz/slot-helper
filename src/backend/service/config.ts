import type z from 'zod';
import { AiConfigSchema } from '../adapter/ai/types.ts';
import { LineConfigSchema } from '../adapter/line/types.ts';
import { GoogleCalendarSettingsSchema } from '../adapter/scheduling/google-calendar.ts';
import { OutlookSettingsSchema } from '../adapter/scheduling/outlook.ts';
import { SchedulingSelectionSchema } from '../adapter/scheduling/types.ts';
import { TelegramConfigSchema } from '../adapter/telegram/types.ts';
import { WhatsappConfigSchema } from '../adapter/whatsapp/types.ts';
import { ExpectedError } from '../core/app-error.ts';
import { aiConfigMapper } from '../model/dto/ai.ts';
import { googleCalendarConfigMapper } from '../model/dto/google-calendar.ts';
import { lineConfigMapper } from '../model/dto/line.ts';
import { outlookConfigMapper } from '../model/dto/outlook.ts';
import { telegramConfigMapper } from '../model/dto/telegram.ts';
import type { ConfigMapper } from '../model/dto/types.ts';
import { whatsappConfigMapper } from '../model/dto/whatsapp.ts';
import { ShopConfigSchema } from '../model/shop-config.ts';
import { SystemConfigSchema } from '../model/system-config.ts';
import type { ConfigKey, ConfigRepository } from '../repository/types.ts';

export interface ConfigService {
  read(section: string): Promise<unknown>; // 沒設定過回 null
  write(section: string, body: unknown): Promise<void>;
}

// [白名單] system-state 這類系統自己寫的設定讀不到也寫不到
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
  ai: aiConfigMapper,
  'google-calendar': googleCalendarConfigMapper,
  outlook: outlookConfigMapper,
  line: lineConfigMapper,
  telegram: telegramConfigMapper,
  whatsapp: whatsappConfigMapper,
};

export function createConfigService(
  configRepository: ConfigRepository,
  onChange: () => void, // 快取失效
): ConfigService {
  return {
    async read(section) {
      const key = assertKnown(section);

      const raw = await configRepository.get(key);
      if (!raw) return null; // 還沒設定過

      const stored = JSON.parse(raw) as unknown;
      const mapper = SECTION_MAPPERS[key]; // mapper 提供掩碼轉換 vo

      return mapper ? mapper.toVo(stored) : stored;
    },

    async write(section, body) {
      const key = assertKnown(section);
      const mapper = SECTION_MAPPERS[key]; // mapper 提供新舊值合併

      let value: unknown;
      if (mapper) {
        // 有 mapper 的區塊要沿用沒送的欄位，需要讀舊設定
        const raw = await configRepository.get(key);
        value = mapper.toConfig(body, raw ? JSON.parse(raw) : null);
      } else {
        value = SECTION_SCHEMAS[key]!.parse(body);
      }

      await configRepository.set(key, JSON.stringify(value));
      onChange();
    },
  };
}

function assertKnown(section: string): ConfigKey {
  if (!SECTION_SCHEMAS[section as ConfigKey]) {
    throw new ExpectedError('未知的設定區塊');
  }
  return section as ConfigKey;
}
