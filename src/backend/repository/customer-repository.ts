import type { Database, Statement } from '../db/types.ts';
import type { Customer } from '../model/entity/customer.ts';
import type { CustomerRepository } from './types.ts';

// 內容需與 migrations/0004_create_customers_table.sql 保持一致
export const CREATE_CUSTOMERS_TABLE: Statement[] = [
  {
    sql: `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  name TEXT,
  display_name TEXT,
  picture_url TEXT,
  last_message TEXT,
  last_message_at INTEGER
)`,
    params: [],
  },
  {
    sql: 'CREATE INDEX IF NOT EXISTS idx_customers_last_message_at ON customers(last_message_at DESC);',
    params: [],
  },
];

export function createCustomerRepository(database: Database): CustomerRepository {
  return {
    async findById(id) {
      const rows = await database.query<Customer>({
        sql: `SELECT id, channel, name,
                     display_name AS displayName,
                     picture_url AS pictureUrl,
                     last_message AS lastMessage,
                     last_message_at AS lastMessageAt
              FROM customers WHERE id = ?`,
        params: [id],
      });
      return rows[0] ?? null;
    },
    // 依最後訊息時間由新到舊，before 是上一批最後一筆的時間
    async list(before, limit) {
      return database.query<Customer>({
        sql: `SELECT id, channel, name,
                     display_name AS displayName,
                     picture_url AS pictureUrl,
                     last_message AS lastMessage,
                     last_message_at AS lastMessageAt
              FROM customers
              WHERE last_message_at IS NOT NULL AND last_message_at < ?
              ORDER BY last_message_at DESC
              LIMIT ?`,
        params: [before ?? Number.MAX_SAFE_INTEGER, limit],
      });
    },
    // name 與 pictureUrl 傳 null 時保留原值，避免渠道暫時查不到資料就把舊的蓋掉
    async upsertProfile({ id, channel, name, pictureUrl }) {
      await database.execute({
        sql: `INSERT INTO customers (id, channel, name, picture_url) VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = COALESCE(excluded.name, name),
                picture_url = COALESCE(excluded.picture_url, picture_url)`,
        params: [id, channel, name, pictureUrl],
      });
    },

    async updateDisplayName(id, displayName) {
      await database.execute({
        sql: 'UPDATE customers SET display_name = ? WHERE id = ?',
        params: [displayName, id],
      });
    },

    async updateLastMessage(id, message, timestamp) {
      await database.execute({
        sql: 'UPDATE customers SET last_message = ?, last_message_at = ? WHERE id = ?',
        params: [message, timestamp, id],
      });
    },
  };
}
