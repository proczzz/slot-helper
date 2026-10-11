import type { Database, Statement } from '../db/types.ts';
import type { Message } from '../model/entity/message.ts';
import type { ConversationRepository } from './types.ts';

// !!! 內容需與 migrations/0001_create_messages_table.sql 保持一致
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  provider TEXT,
  model TEXT,
  trace TEXT
)`;

const CREATE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`;

export const CREATE_MESSAGES_TABLE: Statement[] = [
  { sql: CREATE_TABLE, params: [] },
  { sql: CREATE_INDEX, params: [] },
];

export function createConversationRepository(database: Database): ConversationRepository {
  return {
    async getMessages(sessionId, limit) {
      // 先由新到舊取最後 N 筆,再反轉成時間順序交給 AI
      const rows = await database.query<Message>({
        sql: 'SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?',
        params: [sessionId, limit],
      });
      return rows.reverse();
    },
    // 由新到舊，before 是上一批最後一筆的 id
    async listMessages(sessionId, before, limit) {
      return database.query<Message>({
        sql: `SELECT id, role, content, timestamp, provider, model, trace
              FROM messages
              WHERE session_id = ? AND id < ?
              ORDER BY id DESC LIMIT ?`,
        params: [sessionId, before ?? Number.MAX_SAFE_INTEGER, limit],
      });
    },

    async appendMessages(sessionId, messages) {
      await database.batch(
        messages.map((message) => ({
          sql: `INSERT INTO messages 
                (session_id, role, content, timestamp, provider, model, trace)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [
            sessionId,
            message.role,
            message.content,
            message.timestamp,
            message.provider ?? null,
            message.model ?? null,
            message.trace ?? null,
          ],
        })),
      );
    },
  };
}
