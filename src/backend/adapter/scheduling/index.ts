import { googleCalendarProvider } from './google-calendar.ts';
import { outlookProvider } from './outlook.ts';
import type {
  SchedulingConfig,
  SchedulingProvider,
  SchedulingProviderDefinition,
  TokenStore,
} from './types.ts';

// 新增供應商 = 開一個檔實作 SchedulingProviderDefinition + 這裡加一個
const definitions: SchedulingProviderDefinition[] = [googleCalendarProvider, outlookProvider];

export const providers: Partial<Record<string, SchedulingProviderDefinition>> = Object.fromEntries(
  definitions.map((definition) => [definition.name, definition]),
);

export function createSchedulingProvider(
  config: SchedulingConfig | null,
  tokens: TokenStore,
): SchedulingProvider | null {
  if (!config) return null;

  const definition = providers[config.provider];
  if (!definition) return null;

  return definition.create(config.settings, tokens);
}
