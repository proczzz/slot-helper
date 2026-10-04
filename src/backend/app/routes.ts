import { Hono } from 'hono';
import { adminRoutes } from '../admin/routes.ts';
import { handleError } from './error-handler.ts';
import { lineRoutes } from './line-routes.ts';
import type { AppVariables } from './services.ts';

const routes = new Hono<AppVariables>();

routes.route('/api/admin', adminRoutes);
routes.route('line', lineRoutes);
routes.onError(handleError);

export { routes };
