export interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'fallback' | 'orphan' | 'notice';
  // fallback = 保底訊息
  // orphan = 顧客說了但沒人回應(老闆接手中)。老闆在 LINE 上的回覆收不到,所以紀錄會是半邊對話
  // notice = 系統自己說的話
  content: string;
  timestamp: number;
  provider?: string | null;
  model?: string | null;
  trace?: string | null; // ReplyTrace 的 JSON，沒有呼叫工具與思考紀錄時是 null
}
