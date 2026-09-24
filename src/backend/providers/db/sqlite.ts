import { DatabaseSync } from 'node:sqlite';
import type { Database, Statement } from './types.ts';

export function createSqliteDatabase(filePath: string): Database {
  const db = new DatabaseSync(filePath);

  return {
    async query<T>({ sql, params }: Statement) {
      return db.prepare(sql).all(...params) as unknown as T[];
    },

    async execute({ sql, params }: Statement) {
      db.prepare(sql).run(...params);
    },

    async batch(statements: Statement[]) {
      for (const statement of statements) {
        db.prepare(statement.sql).run(...statement.params);
      }
    },
  };
}
