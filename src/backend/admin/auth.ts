import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'slot-helper';
const EXPIRES_IN = '7d';

export const ADMIN_COOKIE_NAME = 'admin_token';
export const PASSWORD_KEY = 'ADMIN_PASSWORD';
export const JWT_SECRET_KEY = 'ADMIN_JWT_SECRET';

export interface AdminAuth {
  passwordMatches(password: string): boolean;
  issueToken(): Promise<string>;
  verifyToken(token: string): Promise<boolean>;
}

export function createAdminAuth(password: string, jwtSecret: string): AdminAuth {
  const secretKey = new TextEncoder().encode(jwtSecret);

  return {
    passwordMatches(input) {
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

    async verifyToken(token) {
      try {
        await jwtVerify(token, secretKey, { issuer: ISSUER });
        return true;
      } catch {
        return false;
      }
    },
  };
}
