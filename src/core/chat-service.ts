import type { LanguageModel } from 'ai';
import { generateText, stepCountIs } from 'ai';
import type { SchedulingProvider } from '../providers/scheduling/types.ts';
import { buildSystemPrompt } from './build-system-prompt.ts';
import { createSchedulingTools } from './scheduling-tools.ts';
import type { ChatRequest, ChatResponse, ConversationStore } from './types.ts';

export async function handleChat(
  request: ChatRequest,
  model: LanguageModel,
  conversationStore: ConversationStore | null,
  schedulingProvider: SchedulingProvider | null,
): Promise<ChatResponse> {
  const history = conversationStore ? await conversationStore.getMessages(request.sessionId) : [];

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: request.message },
  ];

  const result = await generateText({
    model,
    system: buildSystemPrompt(),
    messages,
    tools: schedulingProvider ? createSchedulingTools(schedulingProvider) : undefined,
    stopWhen: stepCountIs(5),
  });

  if (conversationStore) {
    await conversationStore.appendMessages(request.sessionId, [
      { role: 'user', content: request.message, timestamp: Date.now() },
      { role: 'assistant', content: result.text, timestamp: Date.now() },
    ]);
  }

  return { reply: result.text };
}
