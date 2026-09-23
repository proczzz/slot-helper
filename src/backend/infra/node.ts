import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { routes } from '../app/routes.ts';
import type { AppVariables } from '../app/services.ts';
import { createServices } from '../app/services.ts';
import { sqliteConversationStore } from '../providers/conversation-store/sqlite.ts';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono<AppVariables>();

// http fliter: 在 context 提供各式物件與方法給邏輯層呼叫
app.use(async (c, next) => {
  // [llm、資料庫、日曆]
  c.set(
    'services',
    createServices(process.env, {
      sqlite: () => sqliteConversationStore,
    }),
  );
  // 處裡線程拋出的例外
  c.set('runInBackground', (task) => {
    task.catch((error) => console.error('背景工作失敗:', error));
  });
  await next();
});

app.route('/', routes);
app.use('/*', serveStatic({ root: 'public' }));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`server is running on port ${info.port}`);
});
