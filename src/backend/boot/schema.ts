import type { Statement } from '../db/types.ts';
import { CREATE_CONFIG_TABLE } from '../repository/config-repository.ts';
import { CREATE_MESSAGES_TABLE } from '../repository/conversation-repository.ts';
import { CREATE_CUSTOMERS_TABLE } from '../repository/customer-repository.ts';
import { CREATE_USERS_TABLE } from '../repository/user-repository.ts';

export const CREATE_TABLES: Statement[] = [
  ...CREATE_MESSAGES_TABLE, // 對話記憶表
  ...CREATE_CONFIG_TABLE, // Slot-helper 應用設定表
  ...CREATE_USERS_TABLE, // 後臺用戶表
  ...CREATE_CUSTOMERS_TABLE, // 客戶表
];
