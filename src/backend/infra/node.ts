import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { mkdirSync } from 'node:fs';
import { handleBackgroundFailure } from '../app/error-handler.ts';
import { routes } from '../app/routes.ts';
import type { AppVariables } from '../app/services.ts';
import { createServices } from '../app/services.ts';
import { createSqliteDatabase } from '../db/sqlite.ts';
import type { Statement } from '../db/types.ts';
import { CREATE_CONFIG_TABLE } from '../repository/config-repository.ts';
import { CREATE_MESSAGES_TABLE } from '../repository/conversation-repository.ts';
import { CREATE_CUSTOMERS_TABLE } from '../repository/customer-repository.ts';
import { CREATE_USERS_TABLE } from '../repository/user-repository.ts';

mkdirSync('./data', { recursive: true });
const database = createSqliteDatabase('./data/slot-helper.db'); // 初始化資料庫
export const CREATE_TABLES: Statement[] = [
  ...CREATE_MESSAGES_TABLE, // 對話記憶表
  ...CREATE_CONFIG_TABLE, // Slot-helper 應用設定表
  ...CREATE_USERS_TABLE, // 後臺用戶表
  ...CREATE_CUSTOMERS_TABLE, // 客戶表
];
await database.batch(CREATE_TABLES);

const app = new Hono<AppVariables>();

// http fliter: 在 context 提供各式物件與方法給邏輯層呼叫
app.use(async (c, next) => {
  const services = await createServices(database);
  c.set('services', services);
  c.set('runInBackground', (task) => {
    task.catch(handleBackgroundFailure(services.telegramClient));
  });
  await next();
});

app.route('/', routes);
app.use('/*', serveStatic({ root: './public' }));
app.get('/*', serveStatic({ path: './public/index.html' }));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`server is running on port ${info.port}`);
});
