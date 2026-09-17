import { Hono } from 'hono';
import { handleChat } from '../../core/chat-service.ts';
import type { ChatRequest } from '../../core/types.ts';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get('/message', (c) => {
  return c.text('Hello Hono!');
});

app.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>();
  const result = handleChat(body);
  return c.json(result);
});

export default app;
