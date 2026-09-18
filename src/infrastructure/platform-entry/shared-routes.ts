import type { Context, Env, Hono } from 'hono';
import { handleChat } from '../../core/chat-service.ts';
import { createLanguageModel, listLanguageModels } from '../../ai/language-model/index.ts';
import type { ChatRequest } from '../../core/types.ts';
import type { LanguageModelProviderEnv } from '../../ai/language-model/types.ts';

export function registerChatRoute<E extends Env>(app: Hono<E>, getEnv: (c: Context<E>) => LanguageModelProviderEnv) {
  app.post('/chat', async (c) => {
    const body = await c.req.json<ChatRequest>();
    const model = createLanguageModel(getEnv(c));
    const result = await handleChat(body, model);
    return c.json(result);
  });
}

export function registerModelsRoute<E extends Env>(app: Hono<E>, getEnv: (c: Context<E>) => LanguageModelProviderEnv) {
  app.get('/models', async (c) => {
    const models = await listLanguageModels(getEnv(c));
    return c.json({ data: models });
  });
}
