-- Migration number: 0002 	 2026-09-27T20:12:11.301Z
-- !!! 需要與 src/backend/repository/user-repository.ts 保持一致
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  password TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);
