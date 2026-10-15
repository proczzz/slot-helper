import { jwtVerify, SignJWT } from 'jose';
import { hashPassword, verifyPassword } from '../core/password.ts';
import type { UserRepository } from '../repository/types.ts';

const JWT_ISSUER = 'slot-helper';
// 秒。cookie 的 maxAge 與 jwt 的 exp 共用
export const SESSION_AGE = 60 * 60 * 6;

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
        .setExpirationTime(`${SESSION_AGE}s`)
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

// 去掉 0O1lI 這類看錯機率高的字
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_LENGTH = 8;

function genRandomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
