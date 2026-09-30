import { Hono } from 'hono';
import { adminRoutes } from '../admin/routes.ts';
import { handleChat } from '../core/chat-service.ts';
import { ChatRequestSchema } from '../model/dto/chat.ts';
import { handleError } from './error-handler.ts';
import { jsend } from './jsend.ts';
import { lineRoutes } from './line-routes.ts';
import type { AppVariables } from './services.ts';

const routes = new Hono<AppVariables>();

routes.post('/api/chat', async (c) => {
  // 從 context 取:[llm、營業資訊、資料庫、日曆]的實現 & 請求本體
  const { model, shopSettings, conversationRepository, schedulingProvider } = c.var.services;
  if (!model) return c.json(jsend.error('AI 尚未設定'), 503);

  const request = ChatRequestSchema.parse(await c.req.json());
  // 核心業務
  const result = await handleChat(
    request,
    model,
    shopSettings,
    conversationRepository,
    schedulingProvider,
  );
  // Response 給測試人員
  return c.json(jsend.success(result));
});

routes.route('/api/admin', adminRoutes);
routes.route('line', lineRoutes);
routes.onError(handleError);

export { routes };
