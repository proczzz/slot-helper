export interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: string | null;
  model?: string | null;
}
