import { z } from 'zod';

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, '密碼至少 8 個字元'),
});
