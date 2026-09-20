import type { LanguageModel } from 'ai';

export interface LanguageModelEnv {
  AI_PROVIDER?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface LanguageModelProvider {
  readonly apiKeyEnv: keyof LanguageModelEnv;
  createModel(apiKey: string): LanguageModel;
}
