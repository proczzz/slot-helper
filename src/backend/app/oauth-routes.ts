import { Hono } from 'hono';
import {
  exchangeCode,
  fetchAccountEmail,
  type OutlookState,
} from '../adapter/scheduling/outlook-oauth.ts';
import { createTokenStore, loadOutlookSettings } from './config.ts';
import { takeOauthSession } from './oauth-cookies.ts';
import type { AppVariables } from './services.ts';

// 授權結束後導回的後台頁面
const SETTINGS_PAGE = '/settings/calendar';

const oauthRoutes = new Hono<AppVariables>();

// Microsoft 同意後把瀏覽器導回這裡。不能掛在 /api/admin 底下 ——
// 這是跨站的頂層導覽,SameSite=Strict 的 admin cookie 不會送出。
// 回應不是 JSend 而是 302,因為老闆看到的是一個頁面
oauthRoutes.get('/outlook/callback', async (c) => {
  const { configRepository } = c.var.services;
  const code = c.req.query('code');
  const state = c.req.query('state');

  const { state: expected, redirectUri } = takeOauthSession(c);

  // state 不符代表這不是老闆剛發起的那次授權，不要拿這個 code 去換任何東西
  if (!code || !state || !redirectUri || state !== expected) {
    return c.redirect(`${SETTINGS_PAGE}?oauth=invalid_state`);
  }

  const settings = await loadOutlookSettings(configRepository);
  if (!settings) return c.redirect(`${SETTINGS_PAGE}?oauth=not_configured`);

  try {
    const tokens = await exchangeCode(settings, redirectUri, code);
    const accountEmail = await fetchAccountEmail(tokens.accessToken);

    const next: OutlookState = { refreshToken: tokens.refreshToken, accountEmail };
    await createTokenStore(configRepository).set(JSON.stringify(next));
  } catch (error) {
    console.error('Outlook 授權失敗:', error);
    return c.redirect(`${SETTINGS_PAGE}?oauth=failed`);
  }

  return c.redirect(`${SETTINGS_PAGE}?oauth=connected`);
});

export { oauthRoutes };
