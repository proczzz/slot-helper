import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SESSION_AGE } from '../service/auth';

const COOKIE_NAME = 'admin_token';

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true, // JS 無法讀取此 cookie
    secure: true, // 正式環境必須 true，本機 http 開發測試才能 false
    sameSite: 'Strict', // 只有從本站發起的請求才會帶上
    path: '/',
    maxAge: SESSION_AGE,
  });
}

export function readSessionCookie(c: Context) {
  return getCookie(c, COOKIE_NAME);
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
