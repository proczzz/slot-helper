import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { registerChatRoute, registerModelsRoute } from './shared-routes.ts';

const app = new Hono();

// Node 是常駐進程,環境變數在啟動時讀一次、存成常數即可,
// 不像 Cloudflare 需要每次 request 重新讀。
const env = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};

registerChatRoute(app, () => env);
registerModelsRoute(app, () => env);

const port = 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Node server running at http://localhost:${info.port}`);
});
