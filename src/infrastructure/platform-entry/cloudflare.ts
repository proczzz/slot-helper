import { Hono } from 'hono';
import { handleChat } from '../../core/chat-service.ts';
import type { ChatRequest } from '../../core/types.ts';
import { createLanguageModel } from '../../ai/language-model/index.ts';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get('/message', (c) => {
  return c.text('Hello Hono!');
});

app.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>();
  const model = createLanguageModel({
    AI_PROVIDER: c.env.AI_PROVIDER,
    DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY,
    ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
  });
  const result = await handleChat(body, model);
  return c.json(result);
});

export default app;
