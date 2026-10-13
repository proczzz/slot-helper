import { generateText, stepCountIs } from 'ai';
import type { ActiveModel } from '../adapter/ai/types.ts';
import type { SchedulingProvider } from '../adapter/scheduling/types.ts';
import type { ChatResponse } from '../model/dto/chat.ts';
import type { ConversationRepository } from '../repository/types.ts';
import { buildSystemPrompt } from './build-system-prompt.ts';
import type { Notifier } from './notifications.ts';
import { createSchedulingTools } from './scheduling-tools.ts';
import type { ShopConfig } from './shop-config.ts';
import { createSupportTools } from './support-tools.ts';
import type { ChatSettings } from './system-config.ts';

export interface ChatService {
  handleChat(
    customerId: string,
    customerName: string | null,
    message: string,
  ): Promise<ChatResponse>;
}

const DAY_MS = 24 * 60 * 60_000;

export function createChatService(
  activeModel: ActiveModel | null, // lib & properties
  chatSettings: ChatSettings, // properties
  shopConfig: ShopConfig, // properties
  conversationRepository: ConversationRepository, // repository
  schedulingProvider: SchedulingProvider | null, // service
  notifier: Notifier, // service
): ChatService {
  const supportTools = notifier.enabled ? createSupportTools(notifier) : {};

  return {
    async handleChat(customerId, customerName, message) {
      const receivedAt = Date.now(); // 收到用戶訊息時間

      // Step1. 讀歷史對話(限制訊息輪數&過濾太久的訊息)。設定0輪代表停用，不查資料庫
      const history =
        chatSettings.historyTurns !== 0
          ? await conversationRepository.getMessages(
              customerId,
              chatSettings.historyTurns * 2,
              receivedAt - chatSettings.historyDays * DAY_MS,
            )
          : [];
      const messages = [
        // 騙 AI 哈哈~ 保底訊息(如果有)是他說過的話
        ...history.map((m) => ({
          role: m.role === 'fallback' ? ('assistant' as const) : m.role,
          content: m.content,
        })),
        { role: 'user' as const, content: message },
      ];

      // 準備給 AI 調用的工具
      const schedulingTools = schedulingProvider
        ? createSchedulingTools(schedulingProvider, customerId, shopConfig)
        : {};
      const tools = { ...supportTools, ...schedulingTools };

      // 實際呼叫 llm
      const result = await generateText({
        model: activeModel!.model,
        system: buildSystemPrompt(shopConfig, customerName),
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined, // 沒有時傳 undefined
        stopWhen: stepCountIs(chatSettings.maxSteps), // 工具最多操作次數上限，超過時終止
        onToolExecutionEnd: async ({ toolCall, toolOutput }) => {
          if (toolOutput.type === 'tool-error')
            await notifier.systemError(`工具 ${toolCall.toolName}`, toolOutput.error);
        },
      });

      // 蒐集 AI 處理過程，存 DB
      const trace = collectTrace(result.steps);
      const hasReply = result.text.length > 0;
      const hasTrace = trace.tools.length > 0 || trace.reasoning !== undefined;

      await conversationRepository.appendMessages(customerId, [
        { role: 'user', content: message, timestamp: receivedAt },
        {
          role: hasReply ? 'assistant' : 'fallback',
          content: hasReply ? result.text : chatSettings.fallbackReply,
          timestamp: Date.now(),
          provider: activeModel!.provider,
          model: activeModel!.modelName,
          trace: hasTrace ? JSON.stringify(trace) : null,
        },
      ]);

      return { reply: hasReply ? result.text : chatSettings.fallbackReply };
    },
  };
}

// 會轉字串存 message table > trace 欄位
interface ReplyTrace {
  tools: ToolCallRecord[]; // 工具呼叫紀錄
  reasoning?: ReasoningRecord[]; // 推理模型才有
}

// 存進資料庫中的工具呼叫記錄，避免AI套件改形狀
interface ToolCallRecord {
  step: number;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
}

interface ReasoningRecord {
  step: number;
  text: string;
}

// AI SDK 每一步的內容主體
interface ToolPart {
  type: string;
  toolCallId: string;
  toolName: string;
  text?: string; // reasoning part 的內容
  input?: unknown;
  output?: unknown;
  error?: unknown;
}

function collectTrace(steps: { content: unknown[] }[]): ReplyTrace {
  const tools: ToolCallRecord[] = [];
  const reasoning: ReasoningRecord[] = [];
  const byId = new Map<string, ToolCallRecord>();

  for (const [position, step] of steps.entries()) {
    const stepNumber = position + 1;

    for (const part of step.content as ToolPart[]) {
      if (part.type === 'reasoning') {
        // 同一輪的思考可能切成好幾個 part,合併成一段
        const last = reasoning[reasoning.length - 1];
        if (last && last.step === stepNumber) last.text += part.text ?? '';
        else reasoning.push({ step: stepNumber, text: part.text ?? '' });
        continue;
      }

      if (part.type === 'tool-call') {
        // 同一輪裡的多筆,就是模型一次發出的平行呼叫
        const record: ToolCallRecord = {
          step: stepNumber,
          name: part.toolName,
          input: part.input ?? null,
        };
        tools.push(record);
        byId.set(part.toolCallId, record);
        continue;
      }

      const record = byId.get(part.toolCallId);
      if (!record) continue;

      if (part.type === 'tool-result') {
        record.output = part.output ?? null;
      } else if (part.type === 'tool-error') {
        // Error 直接 stringify 會變成 {}
        record.error = part.error instanceof Error ? part.error.message : String(part.error);
      }
    }
  }

  return reasoning.length > 0 ? { tools, reasoning } : { tools };
}
