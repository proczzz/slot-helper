import type { LanguageModel } from 'ai';
import type { ModelInfo } from 'llm-lister';
import { AppEnv } from '../../app/services';

export type { ModelInfo };

export interface LanguageModelProvider {
  readonly apiKeyEnv: keyof AppEnv;
  createModel(apiKey: string): LanguageModel;
}
