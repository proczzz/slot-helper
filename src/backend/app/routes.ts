import { Hono } from 'hono';
import { adminRoutes } from '../admin/routes.ts';
import { handleChat } from '../core/chat-service.ts';
import { ChatRequestSchema } from '../core/types.ts';
import { lineRoutes } from './line-routes.ts';
import type { AppVariables } from './services.ts';

const routes = new Hono<AppVariables>();

routes.post('/api/chat', async (c) => {
  // 從 context 取:[llm、資料庫、日曆]的實現 & 請求本體
  const { model, conversationStore, schedulingProvider } = c.var.services;
  const request = ChatRequestSchema.parse(await c.req.json());
  // 核心業務
  const result = await handleChat(request, model, conversationStore, schedulingProvider);
  // Response 給測試人員
  return c.json(result);
});

routes.route('/api/admin', adminRoutes);
routes.route('line', lineRoutes);

export { routes };
