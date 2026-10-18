import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { mkdirSync } from 'node:fs';
import { handleBackgroundFailure } from '../boot/error-handler.ts';
import { CREATE_TABLES } from '../boot/schema.ts';
import type { AppVariables } from '../boot/services.ts';
import { createServices } from '../boot/services.ts';
import { createSqliteDatabase } from '../db/sqlite.ts';
import { routes } from '../routes/index.ts';

mkdirSync('./data', { recursive: true });
const database = createSqliteDatabase('./data/slot-helper.db'); // 初始化資料庫
const app = new Hono<AppVariables>();

// http fliter: 在 context 提供各式物件與方法給邏輯層呼叫
app.use(async (c, next) => {
  const services = await createServices(database);
  c.set('services', services);
  c.set('runInBackground', (task) => {
    task.catch(handleBackgroundFailure(services.notifier));
  });
  await next();
});

app.route('/', routes);
app.use('/*', serveStatic({ root: './public' }));
app.get('/*', serveStatic({ path: './public/index.html' }));

// 建表完成才開始收請求。CJS 不支援 top-level await,所以包成函式
async function start() {
  await database.batch(CREATE_TABLES);

  serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
    console.log(`server is running on port ${info.port}`);
  });
}

void start();
