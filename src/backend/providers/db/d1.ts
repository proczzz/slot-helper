import type { Database, Statement } from './types.ts';

export function createD1Database(db: D1Database): Database {
  if (!db) throw new Error('D1 binding 未設定,請檢查 wrangler.jsonc 的 d1_databases');

  return {
    async query<T>({ sql, params }: Statement) {
      const { results } = await db
        .prepare(sql)
        .bind(...params)
        .run<T>();
      return results;
    },

    async execute({ sql, params }: Statement) {
      await db
        .prepare(sql)
        .bind(...params)
        .run();
    },

    async batch(statements: Statement[]) {
      await db.batch(
        statements.map((statement) => db.prepare(statement.sql).bind(...statement.params)),
      );
    },
  };
}
