import type { ConversationStore } from '../../core/types.ts';
import type { Message } from '../../core/types.ts';

// 資料表結構定義在 migrations/0001_create_messages_table.sql
// D1 不支援程式碼執行時自動建表,需要透過 wrangler d1 migrations 指令套用

export function createD1ConversationStore(db: D1Database): ConversationStore {
  return {
    async getMessages(sessionId: string): Promise<Message[]> {
      const { results } = await db
        .prepare(
          'SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
        )
        .bind(sessionId)
        .run<{ role: string; content: string; timestamp: number }>();

      return results.map((row) => ({
        role: row.role as Message['role'],
        content: row.content,
        timestamp: row.timestamp,
      }));
    },

    async appendMessages(sessionId: string, messages: Message[]): Promise<void> {
      const insert = db.prepare(
        'INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)',
      );
      const statements = messages.map((message) =>
        insert.bind(sessionId, message.role, message.content, message.timestamp),
      );
      await db.batch(statements);
    },
  };
}
