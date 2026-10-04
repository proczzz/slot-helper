-- Migration number: 0004 	 2026-10-02T08:37:23.457Z
-- !!! 需要與 src/backend/repository/customer-repository.ts 保持一致
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  name TEXT,
  display_name TEXT,
  picture_url TEXT,
  last_message TEXT,
  last_message_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_customers_last_message_at ON customers(last_message_at DESC);