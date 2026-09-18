import { Context, Hono } from 'hono';
import { registerChatRoute, registerModelsRoute } from './shared-routes.ts';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get('/message', (c) => {
  return c.text('Hello Hono!');
});

const getEnv = (c: Context<{ Bindings: CloudflareBindings }>) => ({
  AI_PROVIDER: c.env.AI_PROVIDER,
  DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY,
  ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
});

registerChatRoute(app, getEnv, () => null);
registerModelsRoute(app, getEnv);

export default app;
