import { jwtVerify, SignJWT } from 'jose';
import type { UserRepository } from '../repository/types.ts';
import { hashPassword, verifyPassword } from './password.ts';

const ISSUER = 'slot-helper';
const EXPIRES_IN = '6h';

export const ADMIN_COOKIE_NAME = 'admin_token';

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
    // 忘記密碼:直接產生新密碼並回傳明文,由呼叫端負責交到本人手上。
    // 帳號不存在或已停用時回 null
    async resetPassword(username) {
      const user = await userRepository.findByUsername(username);
      if (!user || !user.enabled) return null;

      const password = generatePassword();
      await userRepository.updatePassword(username, await hashPassword(password));
      return password;
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

// 去掉 0O1lI 這類看錯機率高的字,老闆要在手機上看、在電腦上打
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_LENGTH = 8;

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
