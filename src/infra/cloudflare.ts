import { Hono } from 'hono';
import { routes } from '../app/routes.ts';
import type { AppVariables } from '../app/services.ts';
import { createServices } from '../app/services.ts';
import { createD1ConversationStore } from '../providers/conversation-store/d1.ts';

const app = new Hono<{ Bindings: CloudflareBindings } & AppVariables>();

app.use(async (c, next) => {
  c.set(
    'services',
    createServices(c.env, {
      d1: () => createD1ConversationStore(c.env.CONVERSATION_DB),
    }),
  );
  // 回應送出後 Workers 會中止未完成的工作,要用 waitUntil 讓平台等它做完
  c.set('runInBackground', (task) => c.executionCtx.waitUntil(task));
  await next();
});

app.route('/', routes);

export default app;
