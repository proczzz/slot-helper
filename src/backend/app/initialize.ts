import { z } from 'zod';
import { hashPassword } from '../admin/password.ts';
import type { ConfigRepository, UserRepository } from '../repository/types.ts';

export const ADMIN_USERNAME = 'admin';

const SystemConfigSchema = z.object({
  jwtSecret: z.string(),
  initializedAt: z.string(),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

export async function ensureInitialized(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<SystemConfig> {
  const raw = await configRepository.get('system'); // 有Secret就當初始化過
  if (raw) return SystemConfigSchema.parse(JSON.parse(raw));

  return initialize(configRepository, userRepository);
}

async function initialize(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<SystemConfig> {
  // 先建'管理帳號'，後建'jwtSecret'，避免jwtSecret成功、管理帳號失敗(沒帳號登入)
  const password = crypto.randomUUID();
  await userRepository.insert({
    username: ADMIN_USERNAME,
    password: await hashPassword(password),
    enabled: true,
  });

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const system = SystemConfigSchema.parse({
    jwtSecret: btoa(String.fromCharCode(...bytes)),
    initializedAt: new Date().toISOString(),
  });

  await configRepository.set('system', JSON.stringify(system));

  console.log('─'.repeat(50));
  console.log(`SlotHelper 已初始化，管理帳號: ${ADMIN_USERNAME}`);
  console.log(`初始密碼: ${password}`);
  console.log('請登入後台後立即修改密碼');
  console.log('─'.repeat(50));

  return system;
}
