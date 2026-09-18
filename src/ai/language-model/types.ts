import { LanguageModel } from 'ai';

export interface LanguageModelProviderEnv {
  AI_PROVIDER?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface ModelInfo {
  id: string;
  provider: string;
}

export interface LanguageModelProvider {
  createModel(env: LanguageModelProviderEnv): LanguageModel;
  listModels(env: LanguageModelProviderEnv): Promise<ModelInfo[]>;
}
