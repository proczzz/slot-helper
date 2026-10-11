export interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'fallback'; // fallback 是保底訊息
  content: string;
  timestamp: number;
  provider?: string | null;
  model?: string | null;
  trace?: string | null; // ReplyTrace 的 JSON，沒有呼叫工具與思考紀錄時是 null
}
