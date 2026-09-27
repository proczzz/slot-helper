import { JWT_SECRET_KEY } from '../admin/auth.ts';
import { hashPassword } from '../admin/password.ts';
import type { ConfigRepository, UserRepository } from '../repository/types.ts';

const INITIALIZED_KEY = 'INITIALIZED';
const DEFAULT_USERNAME = 'admin';

export async function ensureInitialized(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<void> {
  if (await configRepository.get(INITIALIZED_KEY)) return;
  await initialize(configRepository, userRepository);
}

async function initialize(
  configRepository: ConfigRepository,
  userRepository: UserRepository,
): Promise<void> {
  const password = crypto.randomUUID();

  await userRepository.insert({
    username: DEFAULT_USERNAME,
    password: await hashPassword(password),
    enabled: true,
  });

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const jwtSecret = btoa(String.fromCharCode(...bytes));

  await configRepository.setMany([
    { key: JWT_SECRET_KEY, value: jwtSecret },
    { key: INITIALIZED_KEY, value: new Date().toISOString() },
  ]);

  console.log('─'.repeat(50));
  console.log(`SlotHelper 已初始化，管理帳號: ${DEFAULT_USERNAME}`);
  console.log(`初始密碼: ${password}`);
  console.log('請登入後台後立即修改密碼');
  console.log('─'.repeat(50));
}
