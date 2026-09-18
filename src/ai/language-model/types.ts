import type { LanguageModel } from 'ai';
import type { ModelInfo } from 'llm-lister';

export type { ModelInfo };

export interface LanguageModelProviderEnv {
  AI_PROVIDER?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface LanguageModelProvider {
  createModel(env: LanguageModelProviderEnv): LanguageModel;
}
