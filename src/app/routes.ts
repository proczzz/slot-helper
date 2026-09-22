import { Hono } from 'hono';
import { handleChat } from '../core/chat-service.ts';
import { ChatRequestSchema } from '../core/types.ts';
import { lineRoutes } from './line-routes.ts';
import type { AppVariables } from './services.ts';

const routes = new Hono<AppVariables>();

routes.post('/chat', async (c) => {
  const request = ChatRequestSchema.parse(await c.req.json());
  const { model, conversationStore, schedulingProvider } = c.var.services;
  const result = await handleChat(request, model, conversationStore, schedulingProvider);
  return c.json(result);
});

routes.route('line', lineRoutes);

export { routes };
