import { Hono } from 'hono';
import { handleChat } from '../core/chat-service.ts';
import type { Services } from './services.ts';
import { ChatRequestSchema } from '../core/types.ts';

export type AppVariables = { Variables: { services: Services } };

const routes = new Hono<AppVariables>();

routes.post('/chat', async (c) => {
  const request = ChatRequestSchema.parse(await c.req.json());
  const { model, conversationStore, schedulingProvider } = c.var.services;
  const result = await handleChat(request, model, conversationStore, schedulingProvider);
  return c.json(result);
});
routes.get('/models', async (c) => {
  return c.json({ data: await c.var.services.listModels() });
});

export { routes };
