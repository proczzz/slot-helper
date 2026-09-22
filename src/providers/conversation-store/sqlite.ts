import { DatabaseSync } from 'node:sqlite';
import type { ConversationStore, Message } from '../../core/types.ts';

const DB_DIR = process.env.CONVERSATION_DB_DIR || '.';
const DB_NAME = process.env.CONVERSATION_DB_NAME || 'conversations.db';
const DB_PATH = `${DB_DIR}/${DB_NAME}`;

// !!! 這份 schema 必須跟 migrations/0001_create_messages_table.sql 保持一致
// !!! D1(Cloudflare 版)透過 wrangler d1 migrations 套用同一份 schema,兩者需手動同步
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
`;

const db = new DatabaseSync(DB_PATH);
db.exec(CREATE_TABLE_SQL);

export const sqliteConversationStore: ConversationStore = {
    async getMessages(sessionId: string, limit: number): Promise<Message[]> {
    // 先由新到舊取最後 N 筆,再反轉成時間順序交給 AI
    const rows = db
      .prepare(
        'SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?',
      )
      .all(sessionId, limit) as unknown as Message[];

    return rows.reverse();
  },

  async appendMessages(sessionId: string, messages: Message[]): Promise<void> {
    const insert = db.prepare(
      'INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)',
    );
    for (const message of messages) {
      insert.run(sessionId, message.role, message.content, message.timestamp);
    }
  },
};
