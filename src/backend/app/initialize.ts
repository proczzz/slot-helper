import { JWT_SECRET_KEY, PASSWORD_KEY } from '../admin/auth.ts';
import type { ConfigStore } from '../core/types.ts';

const INITIALIZED_KEY = 'INITIALIZED';

export async function ensureInitialized(configStore: ConfigStore): Promise<void> {
  if (await configStore.get(INITIALIZED_KEY)) return;
  await initialize(configStore);
}

async function initialize(configStore: ConfigStore): Promise<void> {
  const password = crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const jwtSecret = btoa(String.fromCharCode(...bytes));

  await configStore.setMany([
    { key: PASSWORD_KEY, value: password },
    { key: JWT_SECRET_KEY, value: jwtSecret },
    { key: INITIALIZED_KEY, value: new Date().toISOString() },
  ]);

  console.log('─'.repeat(50));
  console.log(`SlotHelper 已初始化，初始管理密碼: ${password}`);
  console.log('請登入後台後立即修改密碼');
  console.log('─'.repeat(50));
}
