import { APICallError } from 'ai';

const MAX_REASON_LENGTH = 300;

// 永久失效 = 老闆不處理就不會恢復。判斷交給 SDK:429 與 5xx 的 isRetryable 是 true,
// 而且那些錯誤 SDK 已經自己重試過(預設兩次)才丟到我們手上
export function isPermanentFailure(error: unknown): boolean {
  return APICallError.isInstance(error) && error.isRetryable === false;
}

// 給供應商原文而不是我們自己編的訊息,老闆才知道要去哪裡處理
export function describeFailure(error: unknown): string {
  if (!APICallError.isInstance(error)) return String(error);

  return `${error.statusCode ?? '?'} ${error.responseBody ?? ''}`
    .trim()
    .slice(0, MAX_REASON_LENGTH);
}
