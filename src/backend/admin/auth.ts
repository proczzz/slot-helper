import { jwtVerify, SignJWT } from 'jose';
import type { AdminEnv } from './types.ts';

const ISSUER = 'slot-helper';
const EXPIRES_IN = '7d';

export const ADMIN_COOKIE_NAME = 'admin_token';

export interface AdminAuth {
  passwordMatches(password: string): boolean;
  issueToken(): Promise<string>;
  verifyToken(token: string): Promise<boolean>;
}

export function createAdminAuth(env: AdminEnv): AdminAuth | null {
  const password = env.ADMIN_PASSWORD;
  const jwtSecret = env.ADMIN_JWT_SECRET;
  if (!password || !jwtSecret) return null;

  const secretKey = new TextEncoder().encode(jwtSecret);

  return {
    // FIXME 目前環境變數裡存密碼，之後改成存預設密碼，實際密碼雜湊放DB
    passwordMatches(input: string) {
      return input === password;
    },

    issueToken() {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(EXPIRES_IN)
        .sign(secretKey);
    },

    async verifyToken(token: string) {
      try {
        await jwtVerify(token, secretKey, { issuer: ISSUER });
        return true;
      } catch {
        return false;
      }
    },
  };
}
