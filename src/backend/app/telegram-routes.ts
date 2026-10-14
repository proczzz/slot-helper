import { Hono } from 'hono';
import type { TelegramUpdate } from '../adapter/telegram/types.ts';
import type { AppVariables } from './services.ts';

const telegramRoutes = new Hono<AppVariables>();

telegramRoutes.post('/webhook', async (c) => {
  const { telegramService } = c.var.services;
  if (!(await telegramService.verifyRequest(c.req.raw.headers))) {
    return c.text('Invalid secret token', 401);
  }

  c.var.runInBackground(telegramService.handleUpdate((await c.req.json()) as TelegramUpdate));

  return c.text('OK');
});

export { telegramRoutes };
