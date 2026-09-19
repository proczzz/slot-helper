import { Hono, Context } from 'hono';
import { registerChatRoute, registerModelsRoute } from './shared-routes.ts';
import { createD1ConversationStore } from '../../providers/conversation-store/d1.ts';
import { createSchedulingProvider } from '../../providers/scheduling/index.ts';
import type { ConversationStore } from '../../core/types.ts';

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get('/message', (c) => {
  return c.text('Hello Hono!');
});

const getEnv = (c: Context<{ Bindings: CloudflareBindings }>) => ({
  AI_PROVIDER: c.env.AI_PROVIDER,
  DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY,
  ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
});

function getCloudflareConversationStore(c: Context<{ Bindings: CloudflareBindings }>): ConversationStore | null {
  const setting = c.env.CONVERSATION_STORE;
  if (!setting || setting === 'none') {
    console.log('AI多輪對話記憶:停用');
    return null;
  }
  if (setting === 'd1') {
    console.log('AI多輪對話記憶:啟用-D1儲存');
    return createD1ConversationStore(c.env.CONVERSATION_DB);
  }
  throw new Error(`Unsupported CONVERSATION_STORE: "${setting}"`);
}

function getCloudflareSchedulingProvider(c: Context<{ Bindings: CloudflareBindings }>) {
  return createSchedulingProvider({
    SCHEDULING_PROVIDER: c.env.SCHEDULING_PROVIDER,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: c.env.GOOGLE_PRIVATE_KEY,
    GOOGLE_CALENDAR_ID: c.env.GOOGLE_CALENDAR_ID,
  });
}

registerChatRoute(app, getEnv, getCloudflareConversationStore, getCloudflareSchedulingProvider);
registerModelsRoute(app, getEnv);

export default app;
