import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import { ChatRequestSchema } from './types.ts';
import type { ChatResponse } from './types.ts';

export async function handleChat(rawRequest: unknown, model: LanguageModel): Promise<ChatResponse> {
  const request = ChatRequestSchema.parse(rawRequest);
  const result = await generateText({
    model,
    prompt: request.message,
  });
  return { reply: result.text };
}
