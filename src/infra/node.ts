import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { routes } from '../app/routes.ts';
import type { AppVariables } from '../app/services.ts';
import { createServices } from '../app/services.ts';
import { sqliteConversationStore } from '../providers/conversation-store/sqlite.ts';

const app = new Hono<AppVariables>();

app.use(async (c, next) => {
  c.set(
    'services',
    createServices(process.env, {
      sqlite: () => sqliteConversationStore,
    }),
  );
  await next();
});

app.route('/', routes);

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`server is running on port ${info.port}`);
});
