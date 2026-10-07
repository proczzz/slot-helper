import { Hono } from 'hono';
import { routes } from '../app/routes.ts';
import type { AppVariables } from '../app/services.ts';
import { createServices } from '../app/services.ts';
import { createD1Database } from '../db/d1.ts';

const app = new Hono<{ Bindings: CloudflareBindings } & AppVariables>();

// http fliter: 在 context 提供各式物件與方法給邏輯層呼叫
app.use(async (c, next) => {
  // [llm、資料庫、日曆]
  c.set('services', await createServices(createD1Database(c.env.DB)));
  // 回應送出後 Workers 會中止未完成的工作, waitUntil 方法會讓平台等它做完
  c.set('runInBackground', (task) => {
    c.executionCtx.waitUntil(task.catch((error) => console.error('背景工作失敗:', error)));
  });
  await next();
});

app.route('/', routes);

export default app;
