import { Hono } from 'hono';
import { handleError } from '../boot/error-handler.ts';
import type { AppVariables } from '../boot/services.ts';
import { adminRoutes } from './admin.ts';
import { lineRoutes } from './line.ts';
import { oauthRoutes } from './oauth.ts';
import { telegramRoutes } from './telegram.ts';
import { whatsappRoutes } from './whatsapp.ts';

const routes = new Hono<AppVariables>();

routes.route('/api/admin', adminRoutes);
routes.route('oauth', oauthRoutes);
routes.route('line', lineRoutes);
routes.route('whatsapp', whatsappRoutes);
routes.route('telegram', telegramRoutes);
routes.onError(handleError);

export { routes };
