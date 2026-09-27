import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { mkdirSync } from 'node:fs';
import { routes } from '../app/routes.ts';
import type { AppVariables } from '../app/services.ts';
import { createServices } from '../app/services.ts';
import { createSqliteDatabase } from '../providers/db/sqlite.ts';
import type { Statement } from '../providers/db/types.ts';
import { CREATE_CONFIG_TABLE } from '../repository/config-repository.ts';
import { CREATE_MESSAGES_TABLE } from '../repository/conversation-repository.ts';
import { CREATE_USERS_TABLE } from '../repository/user-repository.ts';

mkdirSync('./data', { recursive: true });
const database = createSqliteDatabase('./data/slot-helper.db'); // 初始化資料庫
export const CREATE_TABLES: Statement[] = [
  ...CREATE_MESSAGES_TABLE, // 對話記憶表
  ...CREATE_CONFIG_TABLE, // Slot-helper 應用設定表
  ...CREATE_USERS_TABLE, // 後臺用戶表
];
await database.batch(CREATE_TABLES);

const app = new Hono<AppVariables>();

// http fliter: 在 context 提供各式物件與方法給邏輯層呼叫
app.use(async (c, next) => {
  // [llm、資料庫、日曆]
  c.set('services', await createServices(database));
  // 處裡線程拋出的例外
  c.set('runInBackground', (task) => {
    task.catch((error) => console.error('背景工作失敗:', error));
  });
  await next();
});

app.route('/', routes);
app.use('/*', serveStatic({ root: './public' }));
app.get('/*', serveStatic({ path: './public/index.html' }));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`server is running on port ${info.port}`);
});
