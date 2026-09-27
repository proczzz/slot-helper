-- Migration number: 0002 	 2026-09-24T23:41:21.411Z
-- !!! 需要與 src/backend/repository/config-repository.ts 保持一致
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
