import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { handleChat } from '../../core/chat-service.ts';
import type { ChatRequest } from '../../core/types.ts';

const app = new Hono();

app.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>();
  const result = handleChat(body);
  return c.json(result);
});

const port = 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Node server running at http://localhost:${info.port}`);
});
