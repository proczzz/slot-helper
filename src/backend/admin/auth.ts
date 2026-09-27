import { jwtVerify, SignJWT } from 'jose';
import type { UserRepository } from '../repository/types.ts';
import { verifyPassword } from './password.ts';

const ISSUER = 'slot-helper';
const EXPIRES_IN = '7d';

export const ADMIN_COOKIE_NAME = 'admin_token';
export const JWT_SECRET_KEY = 'ADMIN_JWT_SECRET';

export interface AdminAuth {
  authenticate(username: string, password: string): Promise<boolean>;
  issueToken(username: string): Promise<string>;
  verifyToken(token: string): Promise<boolean>;
}

export function createAdminAuth(userRepository: UserRepository, jwtSecret: string): AdminAuth {
  const secretKey = new TextEncoder().encode(jwtSecret);

  return {
    // 驗證身分(帳密)
    async authenticate(username, password) {
      const user = await userRepository.findByUsername(username);
      if (!user || !user.enabled) return false;
      return verifyPassword(user.password, password);
    },
    // 發 jwt
    issueToken(username) {
      return new SignJWT({ sub: username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(EXPIRES_IN)
        .sign(secretKey);
    },
    // 驗 jwt
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
