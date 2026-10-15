import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

const STATE = 'oauth_state';
const REDIRECT = 'oauth_redirect';
const OPTIONS = {
  httpOnly: true,
  secure: true, // 同 admin cookie,本機用 http 開發要改 false
  sameSite: 'Lax', // callback 是跨站頂層導覽,Strict 不會送出
  path: '/oauth', // 只在 callback 這條路徑送出
  maxAge: 600, // 老闆同意的過程就 10 分鐘內
} as const;

// 回傳 state 給呼叫端組授權網址。state 的存在理由就是這顆 cookie 的 double-submit,
// 所以它在這裡產生,不在 controller
export function startOauthSession(c: Context, redirectUri: string): string {
  const state = crypto.randomUUID();

  setCookie(c, STATE, state, OPTIONS);
  setCookie(c, REDIRECT, redirectUri, OPTIONS);
  return state;
}

// 讀完就刪 —— callback 不論成敗都不該留著它們
export function takeOauthSession(c: Context): { state?: string; redirectUri?: string } {
  const state = getCookie(c, STATE);
  const redirectUri = getCookie(c, REDIRECT);

  deleteCookie(c, STATE, { path: OPTIONS.path });
  deleteCookie(c, REDIRECT, { path: OPTIONS.path });
  return { state, redirectUri };
}
