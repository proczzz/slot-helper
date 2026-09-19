import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import { ChatRequestSchema } from './types.ts';
import type { ChatResponse, ConversationStore } from './types.ts';
import { buildSystemPrompt } from './build-system-prompt.ts';

export async function handleChat(
  rawRequest: unknown,
  model: LanguageModel,
  conversationStore: ConversationStore | null,
): Promise<ChatResponse> {
  const request = ChatRequestSchema.parse(rawRequest);

  const history = conversationStore ? await conversationStore.getMessages(request.sessionId) : [];

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: request.message },
  ];

  const result = await generateText({ model, system: buildSystemPrompt(), messages });

  if (conversationStore) {
    await conversationStore.appendMessages(request.sessionId, [
      { role: 'user', content: request.message, timestamp: Date.now() },
      { role: 'assistant', content: result.text, timestamp: Date.now() },
    ]);
  }

  return { reply: result.text };
}
