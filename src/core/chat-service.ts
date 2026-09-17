import type { ChatRequest, ChatResponse } from './types.ts';

export function handleChat(request: ChatRequest): ChatResponse {
  return {
    reply: `Reply: ${request.message}`,
  };
}
