import type { Context } from 'hono';
import { ZodError } from 'zod';
import { jsend } from '../model/dto/jsend.ts';

export function handleError(err: Error, c: Context) {
  if (err instanceof ZodError) {
    const fields = Object.fromEntries(
      err.issues.map((issue) => [issue.path.join('.'), issue.message]),
    );
    return c.json(jsend.fail(fields), 400);
  }

  console.error('未預期的錯誤:', err);
  return c.json(jsend.error('伺服器發生錯誤'), 500);
}
