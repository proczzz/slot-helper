import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string('請輸入帳號'),
  password: z.string('請輸入密碼'),
});

export type LoginRequest = z.infer<typeof LoginSchema>;
