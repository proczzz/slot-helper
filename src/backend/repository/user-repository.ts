import type { Database, Statement } from '../providers/db/types.ts';
import type { UserRepository } from './types.ts';

// 內容需與 migrations/0003_create_users_table.sql 保持一致
export const CREATE_USERS_TABLE: Statement[] = [
  {
    sql: `
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  password TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
)`,
    params: [],
  },
];

export function createUserRepository(database: Database): UserRepository {
  return {
    async findByUsername(username) {
      const rows = await database.query<{
        username: string;
        password: string;
        enabled: number;
      }>({
        sql: 'SELECT username, password, enabled FROM users WHERE username = ?',
        params: [username],
      });

      const row = rows[0];
      if (!row) return null;

      return { username: row.username, password: row.password, enabled: row.enabled === 1 };
    },

    async insert(user) {
      await database.execute({
        sql: 'INSERT INTO users (username, password, enabled) VALUES (?, ?, ?)',
        params: [user.username, user.password, user.enabled ? 1 : 0],
      });
    },
  };
}
