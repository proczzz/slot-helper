import { Hono } from 'hono';
import { adminRoutes } from '../admin/routes.ts';
import { handleChat } from '../core/chat-service.ts';
import { ChatRequestSchema } from '../model/dto/chat.ts';
import { jsend } from '../model/dto/jsend.ts';
import { handleError } from './error-handler.ts';
import { lineRoutes } from './line-routes.ts';
import type { AppVariables } from './services.ts';

const routes = new Hono<AppVariables>();

const TEST_CHANNEL = 'test';

routes.post('/api/chat', async (c) => {
  const { model, shopConfig, conversationRepository, schedulingProvider } = c.var.services;
  if (!model) return c.json(jsend.error('AI 尚未設定'), 503);

  const { sessionId, message } = ChatRequestSchema.parse(await c.req.json());

  const result = await handleChat(
    `${TEST_CHANNEL}:${sessionId}`,
    message,
    model,
    shopConfig,
    conversationRepository,
    schedulingProvider,
  );
  return c.json(jsend.success(result));
});

routes.route('/api/admin', adminRoutes);
routes.route('line', lineRoutes);
routes.onError(handleError);

export { routes };
