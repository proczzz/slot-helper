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

    async insert(customer) {
      await database.execute({
        sql: `INSERT INTO customers (id, channel, name, display_name, picture_url, last_message, last_message_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          customer.id,
          customer.channel,
          customer.name,
          customer.displayName,
          customer.pictureUrl,
          customer.lastMessage,
          customer.lastMessageAt,
        ],
      });
    },

    async updateProfile(id, name, pictureUrl) {
      await database.execute({
        sql: 'UPDATE customers SET name = ?, picture_url = ? WHERE id = ?',
        params: [name, pictureUrl, id],
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
