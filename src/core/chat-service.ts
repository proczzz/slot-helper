import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { ChatRequest, ChatResponse } from './types.ts';

export async function handleChat(request: ChatRequest, model: LanguageModel): Promise<ChatResponse> {
  const result = await generateText({
    model,
    prompt: request.message,
  });
  return { reply: result.text };
}
