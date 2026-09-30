export type SqlValue = string | number | bigint | Uint8Array | null;

export interface Statement {
  sql: string;
  params: SqlValue[];
}

export interface Database {
  query<T>(statement: Statement): Promise<T[]>;
  execute(statement: Statement): Promise<void>;
  // 一次送出多筆。D1 是原子的，sqlite 是逐筆執行，不要依賴原子性
  batch(statements: Statement[]): Promise<void>;
}
