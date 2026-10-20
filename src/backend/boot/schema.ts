import type { Statement } from '../db/types.ts';
import { CREATE_CONFIG_TABLE } from '../repository/config-repository.ts';
import { CREATE_MESSAGES_TABLE } from '../repository/conversation-repository.ts';
import { CREATE_CUSTOMERS_TABLE } from '../repository/customer-repository.ts';
import { CREATE_USERS_TABLE } from '../repository/user-repository.ts';

// 改動資料表時:(1) 更新各 CREATE_xxx_TABLE (2) MIGRATIONS 補一筆 (3) 這裡 +1
export const SCHEMA_VERSION = 1;

export const CREATE_TABLES: Statement[] = [
  ...CREATE_MESSAGES_TABLE, // 對話記憶表
  ...CREATE_CONFIG_TABLE, // Slot-helper 應用設定表
  ...CREATE_USERS_TABLE, // 後臺用戶表
  ...CREATE_CUSTOMERS_TABLE, // 客戶表
];

// key = 來源版本。可能併發執行兩次，語句必須能重複跑
export const MIGRATIONS = new Map<number, Statement[]>([
  // [1, [{ sql: 'ALTER TABLE customers ADD COLUMN note TEXT', params: [] }]],
]);
