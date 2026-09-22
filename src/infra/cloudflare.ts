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
  await next();
});

app.route('/', routes);

export default app;
