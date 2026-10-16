import { generateText, stepCountIs } from 'ai';
import { describeFailure, isPermanentFailure } from '../adapter/ai/errors.ts';
import type { ActiveModel, AiStateStore } from '../adapter/ai/types.ts';
import type { SchedulingProvider } from '../adapter/scheduling/types.ts';
import { buildSystemPrompt } from '../core/build-system-prompt.ts';
import { createSchedulingTools } from '../core/scheduling-tools.ts';
import { createSupportTools } from '../core/support-tools.ts';
import type { Message } from '../model/entity/message.ts';
import type { ShopConfig } from '../model/shop-config.ts';
import type { SystemConfig } from '../model/system-config.ts';
import type { Notifier } from './notifier.ts';

export interface ChatResult {
  reply: string; // AI 沒產出內容時是空字串,要不要換成保底訊息由呼叫端決定
  provider: string;
  model: string; // 實際用的那組,可能是備援
  trace: ReplyTrace | null;
}

export interface ChatService {
  ask(
    customerId: string, // 日曆事件的 ownerId
    customerName: string | null,
    message: string,
    history: Message[],
  ): Promise<ChatResult>;
}

const DAY_MS = 24 * 60 * 60_000;

export function createChatService(
  activeModels: ActiveModel[], // lib & properties
  systemConfig: SystemConfig, // properties
  shopConfig: ShopConfig, // properties
  schedulingProvider: SchedulingProvider | null, // service
  notifier: Notifier, // service
  aiState: AiStateStore, // service
): ChatService | null {
  if (activeModels.length === 0) return null;
  const supportTools = notifier.enabled ? createSupportTools(notifier) : {};

  return {
    async ask(customerId, customerName, message, history) {
      const messages = [
        // 準備歷史訊息。騙 AI 哈哈~ 保底訊息(如果有)是他說過的話
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
      const { result, used } = await generate();

      // 蒐集 AI 處理過程，存 DB
      const trace = collectTrace(result.steps);
      const hasTrace = trace.tools.length > 0 || trace.reasoning !== undefined;

      return {
        reply: result.text,
        provider: used.provider,
        model: used.modelName,
        trace: hasTrace ? trace : null,
      };

      // 主要 key 失效就換下一組候選,但只在「還沒有工具執行過」的時候 ——
      // 否則重跑會重放副作用,日曆上那筆預約已經存在了
      async function generate() {
        for (const [index, candidate] of activeModels.entries()) {
          const isLast = index === activeModels.length - 1;
          let touched = false;

          try {
            const result = await generateText({
              model: candidate.model,
              system: buildSystemPrompt(shopConfig, customerName),
              messages,
              tools: Object.keys(tools).length > 0 ? tools : undefined, // 沒有時傳 undefined
              stopWhen: stepCountIs(systemConfig.maxSteps), // 工具最多操作次數上限，超過時終止
              onToolExecutionEnd: async ({ toolCall, toolOutput }) => {
                touched = true;
                if (toolOutput.type === 'tool-error')
                  await notifier.systemError(`工具 ${toolCall.toolName}`, toolOutput.error);
              },
            });
            return { result, used: candidate };
          } catch (error) {
            if (isPermanentFailure(error)) {
              // 等待後也無法復原的問題:降級key。只有第一次降級才通知,否則每則訊息都會發一次
              if (await aiState.demote(candidate.name, describeFailure(error))) {
                await notifier.aiDemoted(candidate.name, describeFailure(error));
              }
            }

            if (touched || isLast) {
              if (isLast) await notifier.systemError('所有 AI 模型都無法使用', error);
              throw error;
            }
            console.error(`AI 模型 ${candidate.name} 失敗，改用下一組:`, error);
          }
        }

        // activeModels 在工廠就保證非空,這行只是讓 TS 知道函式一定有出口
        throw new Error('沒有可用的 AI 模型');
      }
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
