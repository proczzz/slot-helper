import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { registerChatRoute, registerModelsRoute } from './shared-routes.ts';
import { sqliteConversationStore } from '../../providers/conversation-store/sqlite.ts';
import { createGoogleCalendarProvider } from '../../providers/scheduling/google-calendar.ts';
import type { ConversationStore } from '../../core/types.ts';
import type { SchedulingProvider } from '../../providers/scheduling/types.ts';

const app = new Hono();

// Node 是常駐進程,環境變數在啟動時讀一次、存成常數即可,
// 不像 Cloudflare 需要每次 request 重新讀。
const env = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};

function getNodeConversationStore(): ConversationStore | null {
  const setting = process.env.CONVERSATION_STORE;
  if (!setting || setting === 'none') {
    console.log('AI多輪對話記憶:停用');
    return null;
  }
  if (setting === 'sqlite') {
    console.log('AI多輪對話記憶:啟用-使用Sqlite儲存');
    return sqliteConversationStore;
  }
  throw new Error(`Unsupported CONVERSATION_STORE: "${setting}"`);
}

const conversationStore = getNodeConversationStore();

function getNodeSchedulingProvider(): SchedulingProvider | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !calendarId) {
    return null;
  }

  return createGoogleCalendarProvider({
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    calendarId,
  });
}

const schedulingProvider = getNodeSchedulingProvider();

registerChatRoute(
  app,
  () => env,
  () => conversationStore,
  () => schedulingProvider,
);
registerModelsRoute(app, () => env);

const port = 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Node server running at http://localhost:${info.port}`);
});
