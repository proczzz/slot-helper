import { z } from 'zod';
import { hashPassword } from '../core/password.ts';
import type { ConfigRepository, UserRepository } from '../repository/types.ts';
import type { Database } from '../db/types.ts';
import { CREATE_TABLES } from './schema.ts';

export const ADMIN_USERNAME = 'admin';

const SystemStateSchema = z.object({
  jwtSecret: z.string(),
  initializedAt: z.string(),
});

export type SystemState = z.infer<typeof SystemStateSchema>;

export async function ensureInitialized(
  database: Database,
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<SystemState> {
  // Cloudflare 沒有啟動階段可以建表,第一次讀不到就當成空資料庫。
  // Node 在啟動時已經建好,所以這裡不會觸發
  let raw: string | null;
  try {
    raw = await configRepository.get('system-state');
  } catch {
    await database.batch(CREATE_TABLES);
    raw = null;
  }

  if (raw) return SystemStateSchema.parse(JSON.parse(raw));

  return initialize(configRepository, userRepository);
}

async function initialize(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<SystemState> {
  // 先建'管理帳號'，後建'jwtSecret'，避免jwtSecret成功、管理帳號失敗(沒帳號登入)
  const password = crypto.randomUUID();
  await userRepository.insert({
    username: ADMIN_USERNAME,
    password: await hashPassword(password),
    enabled: true,
  });

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const system = SystemStateSchema.parse({
    jwtSecret: btoa(String.fromCharCode(...bytes)),
    initializedAt: new Date().toISOString(),
  });

  await configRepository.set('system-state', JSON.stringify(system));

  console.log('─'.repeat(50));
  console.log(`SlotHelper 已初始化，管理帳號: ${ADMIN_USERNAME}`);
  console.log(`初始密碼: ${password}`);
  console.log('請登入後台後立即修改密碼');
  console.log('─'.repeat(50));

  return system;
}
