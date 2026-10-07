import { hashPassword } from '../admin/password.ts';
import type { ConfigRepository, UserRepository } from '../repository/types.ts';

export const ADMIN_USERNAME = 'admin';

export async function ensureInitialized(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<void> {
  if (await configRepository.get('system')) return; // 有Secret就當初始化過
  await initialize(configRepository, userRepository);
}

async function initialize(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<void> {
  // 先建'管理帳號'，後建'jwtSecret'，避免jwtSecret成功、管理帳號失敗(沒帳號登入)
  const password = crypto.randomUUID();
  await userRepository.insert({
    username: ADMIN_USERNAME,
    password: await hashPassword(password),
    enabled: true,
  });

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const jwtSecret = btoa(String.fromCharCode(...bytes));

  await configRepository.set(
    'system',
    JSON.stringify({ jwtSecret, initializedAt: new Date().toISOString() }),
  );

  console.log('─'.repeat(50));
  console.log(`SlotHelper 已初始化，管理帳號: ${ADMIN_USERNAME}`);
  console.log(`初始密碼: ${password}`);
  console.log('請登入後台後立即修改密碼');
  console.log('─'.repeat(50));
}
