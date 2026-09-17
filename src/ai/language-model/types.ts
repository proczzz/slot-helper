import { LanguageModel } from 'ai';

export interface LanguageModelProviderEnv {
  AI_PROVIDER?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface LanguageModelProvider {
  createModel(env: LanguageModelProviderEnv): LanguageModel;
}
