import type { LanguageModel } from 'ai';
import { generateText, stepCountIs } from 'ai';
import type { SchedulingProvider } from '../adapter/scheduling/types.ts';
import type { ChatResponse } from '../model/dto/chat.ts';
import type { ConversationRepository } from '../repository/types.ts';
import { buildSystemPrompt } from './build-system-prompt.ts';
import { createSchedulingTools } from './scheduling-tools.ts';
import type { ShopConfig } from './shop-config.ts';
import type { TelegramClient } from '../adapter/telegram/types.ts';
import { createSupportTools } from './support-tools.ts';

const HISTORY_LIMIT = 40;

export async function handleChat(
  customerId: string,
  customerName: string | null,
  message: string,
  model: LanguageModel,
  shopConfig: ShopConfig,
  conversationRepository: ConversationRepository,
  schedulingProvider: SchedulingProvider | null,
  telegramClient: TelegramClient | null,
): Promise<ChatResponse> {
  const receivedAt = Date.now(); // 用戶發訊息時間
  // 若有開啟記憶功能 -> 先讀歷史對話(最多讀40則)
  const history = await conversationRepository.getMessages(customerId, HISTORY_LIMIT);
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  // 兩組工具合併。全空時要傳 undefined 而不是 {},避免送出空的 tools 欄位
  const tools = {
    ...(schedulingProvider
      ? createSchedulingTools(schedulingProvider, customerId, shopConfig)
      : {}),
    ...(telegramClient ? createSupportTools(telegramClient, customerName) : {}),
  };

  // 實際呼叫 llm
  const result = await generateText({
    model,
    system: buildSystemPrompt(shopConfig, customerName),
    messages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
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

  if (result.text) {
    await conversationRepository.appendMessages(customerId, [
      { role: 'user', content: message, timestamp: receivedAt },
      { role: 'assistant', content: result.text, timestamp: Date.now() },
    ]);
  }

  return { reply: result.text };
}
