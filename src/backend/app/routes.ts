import { Hono } from 'hono';
import { adminRoutes } from '../admin/routes.ts';
import { handleChat } from '../core/chat-service.ts';
import { ChatRequestSchema, TestCustomerSchema } from '../model/dto/chat.ts';
import { jsend } from '../model/dto/jsend.ts';
import { handleError } from './error-handler.ts';
import { lineRoutes } from './line-routes.ts';
import type { AppVariables } from './services.ts';

const routes = new Hono<AppVariables>();

const TEST_CHANNEL = 'test';

routes.post('/api/test-customers', async (c) => {
  const { customerRepository } = c.var.services;
  const { id, name } = TestCustomerSchema.parse(await c.req.json());

  await customerRepository.upsertProfile({
    id: `${TEST_CHANNEL}:${id}`,
    channel: TEST_CHANNEL,
    name,
    pictureUrl: null,
  });

  return c.json(jsend.success(null));
});

routes.post('/api/chat', async (c) => {
  const { model, shopConfig, conversationRepository, customerRepository, schedulingProvider } =
    c.var.services;
  if (!model) return c.json(jsend.error('AI 尚未設定'), 503);

  const { sessionId, message } = ChatRequestSchema.parse(await c.req.json());
  const id = `${TEST_CHANNEL}:${sessionId}`;

  const customer = await customerRepository.findById(id);
  if (!customer) return c.body(null, 404);

  const result = await handleChat(
    id,
    customer.name,
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
