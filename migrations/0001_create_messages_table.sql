-- Migration number: 0001 	 2026-09-19T03:18:37.511Z
-- !!! 這份 schema 必須跟 src/providers/conversation-store/sqlite.ts 裡的
-- !!! CREATE_TABLE_SQL 保持一致(Node 版透過 db.exec() 使用同一份 schema)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
