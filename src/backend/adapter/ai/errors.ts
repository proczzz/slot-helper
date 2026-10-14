import { APICallError } from 'ai';

const MAX_REASON_LENGTH = 200;

// 永久失效 = 老闆不處理就不會恢復。判斷交給 SDK:429 與 5xx 的 isRetryable 是 true,
// 而且那些錯誤 SDK 已經自己重試過(預設兩次)才丟到我們手上
export function isPermanentFailure(error: unknown): boolean {
  return APICallError.isInstance(error) && error.isRetryable === false;
}

export function describeFailure(error: unknown): string {
  if (!APICallError.isInstance(error)) return String(error).slice(0, MAX_REASON_LENGTH);

  return `${error.statusCode ?? '?'} ${extractMessage(error.responseBody)}`
    .trim()
    .slice(0, MAX_REASON_LENGTH);
}

// 各家的錯誤 body 幾乎都是 { error: { message } }
// 形狀不同或根本不是 JSON 就原樣給
function extractMessage(body: string | undefined): string {
  if (!body) return '';

  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? body;
  } catch {
    return body;
  }
}
