import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { handleChat } from '../../core/chat-service.ts';
import type { ChatRequest } from '../../core/types.ts';
import { createLanguageModel } from '../../ai/language-model/index.ts';

const app = new Hono();

// 不同於 cloudflare worker ， node 環境不會銷毀重建，啟動時讀一次環境變數就好
const model = createLanguageModel({
  AI_PROVIDER: process.env.AI_PROVIDER,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});

app.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>();
  const result = await handleChat(body, model);
  return c.json(result);
});

const port = 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Node server running at http://localhost:${info.port}`);
});
