// 可預期的失敗:設定沒填完、授權過期、呼叫端送錯東西。
// 回 400 把訊息交給呼叫端,不當成系統故障通知老闆
export class ExpectedError extends Error {}
