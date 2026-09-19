import { Hono, Context } from 'hono';
import { registerChatRoute, registerModelsRoute } from './shared-routes.ts';
import { createD1ConversationStore } from '../../providers/conversation-store/d1.ts';
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

registerChatRoute(app, getEnv, getCloudflareConversationStore);
registerModelsRoute(app, getEnv);

export default app;
