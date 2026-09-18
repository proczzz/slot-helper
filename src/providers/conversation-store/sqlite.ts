import { DatabaseSync } from 'node:sqlite';
import type { ConversationStore } from './types.ts';
import type { Message } from '../../core/types.ts';

const DB_PATH = process.env.CONVERSATION_DB_PATH || 'conversations.db';

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
  async getMessages(sessionId: string): Promise<Message[]> {
    const rows = db
      .prepare('SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC')
      .all(sessionId) as { role: string; content: string; timestamp: number }[];

    return rows.map((row) => ({
      role: row.role as Message['role'],
      content: row.content,
      timestamp: row.timestamp,
    }));
  },

  async appendMessages(sessionId: string, messages: Message[]): Promise<void> {
    const insert = db.prepare('INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)');
    for (const message of messages) {
      insert.run(sessionId, message.role, message.content, message.timestamp);
    }
  },
};
