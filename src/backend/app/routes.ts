import { Hono } from 'hono';
import { adminRoutes } from '../admin/routes.ts';
import { handleError } from './error-handler.ts';
import { lineRoutes } from './line-routes.ts';
import type { AppVariables } from './services.ts';
import { telegramRoutes } from './telegram-routes.ts';

const routes = new Hono<AppVariables>();

routes.route('/api/admin', adminRoutes);
routes.route('line', lineRoutes);
routes.route('telegram', telegramRoutes);
routes.onError(handleError);

export { routes };
