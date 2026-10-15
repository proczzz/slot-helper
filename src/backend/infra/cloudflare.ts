import { Hono } from 'hono';
import { handleBackgroundFailure } from '../boot/error-handler.ts';
import type { AppVariables } from '../boot/services.ts';
import { createServices } from '../boot/services.ts';
import { createD1Database } from '../db/d1.ts';
import { routes } from '../routes/index.ts';

const app = new Hono<{ Bindings: CloudflareBindings } & AppVariables>();

// http fliter: 在 context 提供各式物件與方法給邏輯層呼叫
app.use(async (c, next) => {
  // [llm、資料庫、日曆]
  const services = await createServices(createD1Database(c.env.DB));
  c.set('services', services);
  // 回應送出後 Workers 會中止未完成的工作, waitUntil 方法會讓平台等它做完
  c.set('runInBackground', (task) => {
    c.executionCtx.waitUntil(task.catch(handleBackgroundFailure(services.notifier)));
  });
  await next();
});

app.route('/', routes);

export default app;
