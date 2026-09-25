import type { ConfigStore } from '../core/types.ts';
import type { Database, Statement } from './db/types.ts';

// !!! 內容需與 migrations/0002_create_config_table.sql 保持一致
export const CREATE_CONFIG_TABLE: Statement[] = [
  {
    sql: `
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`,
    params: [],
  },
];

const UPSERT =
  'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';

export function createConfigStore(database: Database): ConfigStore {
  return {
    async get(key) {
      const rows = await database.query<{ value: string }>({
        sql: 'SELECT value FROM config WHERE key = ?',
        params: [key],
      });
      return rows[0]?.value ?? null;
    },

    async set(key, value) {
      await database.execute({ sql: UPSERT, params: [key, value] });
    },

    async setMany(entries) {
      await database.batch(
        entries.map(({ key, value }) => ({ sql: UPSERT, params: [key, value] })),
      );
    },
  };
}
