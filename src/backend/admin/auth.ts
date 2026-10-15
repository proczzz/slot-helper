import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { jwtVerify, SignJWT } from 'jose';
import type { UserRepository } from '../repository/types.ts';
import { hashPassword, verifyPassword } from './password.ts';

const JWT_COOKIE_NAME = 'admin_token';
const JWT_ISSUER = 'slot-helper';
// 秒。cookie 的 maxAge 與 jwt 的 exp 共用
const JWT_AGE = 60 * 60 * 6;

export interface AdminAuth {
  authenticate(username: string, password: string): Promise<boolean>;
  changePassword(username: string, currentPassword: string, newPassword: string): Promise<boolean>;
  resetPassword(username: string): Promise<string | null>;
  issueToken(username: string): Promise<string>;
  verifyToken(token: string): Promise<string | null>;
}

export function createAdminAuth(userRepository: UserRepository, jwtSecret: string): AdminAuth {
  const secretKey = new TextEncoder().encode(jwtSecret);

  return {
    // 帳號密碼驗證
    async authenticate(username, password) {
      const user = await userRepository.findByUsername(username);
      if (!user || !user.enabled) return false;
      return verifyPassword(user.password, password);
    },
    // 更換密碼
    async changePassword(username, currentPassword, newPassword) {
      if (!(await this.authenticate(username, currentPassword))) return false;
      await userRepository.updatePassword(username, await hashPassword(newPassword));
      return true;
    },
    // 忘記密碼:更新隨機密碼，並回傳新密碼
    async resetPassword(username) {
      const user = await userRepository.findByUsername(username);
      if (!user || !user.enabled) return null;
      const password = genRandomPassword();
      await userRepository.updatePassword(username, await hashPassword(password));
      return password;
    },
    // 發 jwt
    issueToken(username) {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(username)
        .setIssuer(JWT_ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${JWT_AGE}s`)
        .sign(secretKey);
    },
    // 驗 jwt 若成功將回傳用戶身份
    async verifyToken(token) {
      try {
        const { payload } = await jwtVerify(token, secretKey, { issuer: JWT_ISSUER });
        return payload.sub ?? null;
      } catch {
        return null;
      }
    },
  };
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, JWT_COOKIE_NAME, token, {
    httpOnly: true, // JS 無法讀取此 cookie
    secure: true, // 正式環境必須 true，本機 http 開發測試才能 false
    sameSite: 'Strict', // 只有從本站發起的請求才會帶上
    path: '/',
    maxAge: JWT_AGE,
  });
}

export function readSessionCookie(c: Context) {
  return getCookie(c, JWT_COOKIE_NAME);
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, JWT_COOKIE_NAME, { path: '/' });
}

// 去掉 0O1lI 這類看錯機率高的字
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_LENGTH = 8;

function genRandomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
