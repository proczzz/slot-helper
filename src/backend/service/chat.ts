import { APICallError, generateText, stepCountIs } from 'ai';
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
  failed?: unknown; // 所有候選都失敗,reply 必定是空字串
  reported?: boolean; // chat 已經發過更具體的通知了,呼叫端不用再發
}

export interface ChatService {
  ask(
    customerId: string, // 日曆事件的 ownerId
    customerName: string | null,
    message: string,
    history: Message[],
  ): Promise<ChatResult>;
}

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
        // 上一層只會給 user / assistant / fallback,保底訊息算 AI 說過的話
        ...history.map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
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
      const attempt = await generate();

      // -- 失敗分支 -- 沒有產出結果。這不是意外,顧客會收到保底訊息
      if (!attempt.ok) {
        return {
          reply: '',
          provider: attempt.used.provider,
          model: attempt.used.modelName,
          trace: attempt.touched.length > 0 ? { tools: attempt.touched } : null,
          failed: attempt.failed,
          reported: attempt.reported,
        };
      }

      // -- 成功分支 -- 蒐集 AI 處理過程，存 DB
      const trace = collectTrace(attempt.result.steps);
      const hasTrace = trace.tools.length > 0 || trace.reasoning !== undefined;

      return {
        reply: attempt.result.text,
        provider: attempt.used.provider,
        model: attempt.used.modelName,
        trace: hasTrace ? trace : null,
      };

      // 主要 key 失效就換下一組候選,但只在「還沒有工具執行過」的時候 ——
      // 否則重跑會重放副作用,日曆上那筆預約已經存在了
      async function generate() {
        let remaining = activeModels.length; // 剩下的可用模型數量
        let reported = false;
        for (const [index, candidate] of activeModels.entries()) {
          const isLast = index === activeModels.length - 1;
          const touched: ToolCallRecord[] = []; // AI 已經操作過的工具

          try {
            const result = await generateText({
              model: candidate.model,
              system: buildSystemPrompt(shopConfig, customerName),
              messages,
              tools: Object.keys(tools).length > 0 ? tools : undefined, // 沒有時傳 undefined
              stopWhen: stepCountIs(systemConfig.maxSteps), // 工具最多操作次數上限，超過時終止
              onToolExecutionEnd: async ({ toolCall, toolOutput }) => {
                const record: ToolCallRecord = {
                  step: touched.length + 1,
                  name: toolCall.toolName,
                  input: toolCall.input,
                };
                if (toolOutput.type === 'tool-error') {
                  record.error =
                    toolOutput.error instanceof Error
                      ? toolOutput.error.message
                      : String(toolOutput.error);
                  await notifier.systemError(`工具 ${toolCall.toolName}`, toolOutput.error);
                } else {
                  record.output = toolOutput.output;
                }

                touched.push(record);
              },
            });
            return { ok: true as const, result, used: candidate };
          } catch (error) {
            console.error('AI 失敗原始樣貌:', {
              name: error instanceof Error ? error.name : typeof error,
              message: error instanceof Error ? error.message : String(error),
              isApiCallError: APICallError.isInstance(error),
              statusCode: APICallError.isInstance(error) ? error.statusCode : undefined,
              body: APICallError.isInstance(error) ? error.responseBody : undefined,
            });
            // 等待後也無法復原的問題: 降級
            if (isPermanentFailure(error)) {
              if (await aiState.demote(candidate.name, describeFailure(error))) {
                remaining -= 1;
                reported = true;
                await notifier.aiDemoted(candidate.name, describeFailure(error), remaining);
              }
            }

            // 操作過工具後，繼續呼叫 AI 時拋錯
            if (touched.length > 0) {
              reported = true;
              await notifier.toolInterrupted(
                touched.map((tool) => tool.name),
                describeFailure(error),
              );
            } else if (!isLast) {
              // AI拋錯，沒操作工具 且 還有備用 key 可用
              console.error(`AI 模型 ${candidate.name} 失敗，改用下一組:`, error);
              continue;
            }
            return { ok: false as const, used: candidate, failed: error, touched, reported };
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
