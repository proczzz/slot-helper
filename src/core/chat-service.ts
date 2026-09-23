import type { LanguageModel } from 'ai';
import { generateText, stepCountIs } from 'ai';
import type { SchedulingProvider } from '../providers/scheduling/types.ts';
import { buildSystemPrompt } from './build-system-prompt.ts';
import { createSchedulingTools } from './scheduling-tools.ts';
import type { ChatRequest, ChatResponse, ConversationStore } from './types.ts';

const HISTORY_LIMIT = 40;

export async function handleChat(
  request: ChatRequest,
  model: LanguageModel,
  conversationStore: ConversationStore | null,
  schedulingProvider: SchedulingProvider | null,
): Promise<ChatResponse> {
  // 若有開啟記憶功能 -> 先讀歷史對話(最多讀40則)
  const history = conversationStore
    ? await conversationStore.getMessages(request.sessionId, HISTORY_LIMIT)
    : [];

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: request.message },
  ];

  // 實際呼叫 llm
  const result = await generateText({
    model,
    system: buildSystemPrompt(),
    messages,
    tools: schedulingProvider
      ? createSchedulingTools(schedulingProvider, request.customerId)
      : undefined,
    stopWhen: stepCountIs(8),
  });

  // 只記錄工具呼叫、結果與錯誤;推理過程和回覆文字不記
  // Error 物件直接 stringify 會變成 {},轉成訊息字串
  const toolParts = result.steps
    .flatMap((s) => s.content)
    .filter((p) => ['tool-call', 'tool-result', 'tool-error'].includes(p.type));

  console.debug(
    JSON.stringify(toolParts, (_, value) => (value instanceof Error ? value.message : value)),
  );

  if (conversationStore) {
    await conversationStore.appendMessages(request.sessionId, [
      { role: 'user', content: request.message, timestamp: Date.now() },
      { role: 'assistant', content: result.text, timestamp: Date.now() },
    ]);
  }

  return { reply: result.text };
}
