import { jwtVerify, SignJWT } from 'jose';
import type { UserRepository } from '../repository/types.ts';
import { hashPassword, verifyPassword } from './password.ts';

const ISSUER = 'slot-helper';
const EXPIRES_IN = '6h';

export const ADMIN_COOKIE_NAME = 'admin_token';

export interface AdminAuth {
  authenticate(username: string, password: string): Promise<boolean>;
  changePassword(username: string, currentPassword: string, newPassword: string): Promise<boolean>;
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
    // 發 jwt
    issueToken(username) {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(username)
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(EXPIRES_IN)
        .sign(secretKey);
    },
    // 驗 jwt 若成功將回傳用戶身份
    async verifyToken(token) {
      try {
        const { payload } = await jwtVerify(token, secretKey, { issuer: ISSUER });
        return payload.sub ?? null;
      } catch {
        return null;
      }
    },
  };
}
