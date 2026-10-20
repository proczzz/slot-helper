import { z } from 'zod';
import { APP_VERSION } from '../../version.ts';
import { hashPassword } from '../core/password.ts';
import type { Database } from '../db/types.ts';
import type { ConfigRepository, UserRepository } from '../repository/types.ts';
import { CREATE_TABLES, MIGRATIONS, SCHEMA_VERSION } from './schema.ts';

export const ADMIN_USERNAME = 'admin';

const SystemStateSchema = z.object({
  jwtSecret: z.string(),
  initializedAt: z.string(),
  schemaVersion: z.number().default(1),
  appVersion: z.string().default(''), // 只是註記，不代表當前運行版本
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

  if (raw === null) return initialize(configRepository, userRepository);

  const state = SystemStateSchema.parse(JSON.parse(raw));
  if (state.schemaVersion >= SCHEMA_VERSION) return state;
  return migrate(database, configRepository, state);
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
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
  });

  await configRepository.set('system-state', JSON.stringify(system));

  console.info('─'.repeat(50));
  console.info(`SlotHelper 已初始化，管理帳號: ${ADMIN_USERNAME}`);
  console.info(`初始密碼: ${password}`);
  console.info('請登入後台後立即修改密碼');
  console.info('─'.repeat(50));

  return system;
}

async function migrate(
  database: Database,
  configRepository: ConfigRepository,
  state: SystemState,
): Promise<SystemState> {
  for (let from = state.schemaVersion; from < SCHEMA_VERSION; from++) {
    const statements = MIGRATIONS.get(from);
    if (statements === undefined) throw new Error(`缺少 schema ${from} -> ${from + 1} 的升級語句`);
    await database.batch(statements);
    console.info(`資料表升級: ${from} -> ${from + 1}`);
  }

  const upgraded = { ...state, schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION };
  await configRepository.set('system-state', JSON.stringify(upgraded));
  return upgraded;
}
