import type { Context } from 'hono';
import { ZodError } from 'zod';
import { ExpectedError } from '../core/app-error.ts';
import type { Notifier } from '../core/notifications.ts';
import { jsend } from '../model/dto/jsend.ts';
import type { AppVariables } from './services.ts';

// http 框架層級錯誤處理
export function handleError(err: Error, c: Context<AppVariables>) {
  // 資料型態檢查不正確。不是系統故障，不通知
  if (err instanceof ZodError) {
    const fields = Object.fromEntries(
      err.issues.map((issue) => [issue.path.join('.'), issue.message]),
    );
    return c.json(jsend.fail(fields), 400);
  }
  if (err instanceof ExpectedError) {
    return c.json(jsend.fail(err.message), 400);
  }

  console.error('未預期的錯誤:', err);
  c.var.runInBackground(c.var.services.notifier.systemError(`${c.req.method} ${c.req.path}`, err));

  return c.json(jsend.error('伺服器發生錯誤'), 500);
}

// 背景執行層級錯誤處理
export function handleBackgroundFailure(notifier: Notifier) {
  return (error: unknown) => {
    console.error('背景工作失敗:', error);
    void notifier.systemError('背景工作', error);
  };
}
