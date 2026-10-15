import { z } from 'zod';

export const LoginReqSchema = z.object({
  username: z.string('請輸入帳號'),
  password: z.string('請輸入密碼'),
});
