import type { Context, Env, Hono } from 'hono';
import { handleChat } from '../../core/chat-service.ts';
import { createLanguageModel, listLanguageModels } from '../../ai/language-model/index.ts';
import type { LanguageModelProviderEnv } from '../../ai/language-model/types.ts';
import type { ConversationStore } from '../../core/types.ts';
import type { SchedulingProvider } from '../../providers/scheduling/types.ts';

export function registerChatRoute<E extends Env>(
  app: Hono<E>,
  getEnv: (c: Context<E>) => LanguageModelProviderEnv,
  getConversationStore: (c: Context<E>) => ConversationStore | null,
  getSchedulingProvider: (c: Context<E>) => SchedulingProvider | null,
) {
  app.post('/chat', async (c) => {
    const body: unknown = await c.req.json();
    const model = createLanguageModel(getEnv(c));
    const conversationStore = getConversationStore(c);
    const schedulingProvider = getSchedulingProvider(c);
    const result = await handleChat(body, model, conversationStore, schedulingProvider);
    return c.json(result);
  });
}

export function registerModelsRoute<E extends Env>(app: Hono<E>, getEnv: (c: Context<E>) => LanguageModelProviderEnv) {
  app.get('/models', async (c) => {
    const models = await listLanguageModels(getEnv(c));
    return c.json({ data: models });
  });
}
