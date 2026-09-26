import type { LanguageModel } from 'ai';

export interface LanguageModelConfig {
  AI_PROVIDER?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface LanguageModelProvider {
  readonly apiKeyEnv: keyof LanguageModelConfig;
  createModel(apiKey: string): LanguageModel;
}
