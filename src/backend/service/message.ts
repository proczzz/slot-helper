import type { IncomingMessage, MessagingClient } from '../adapter/types.ts';
import type { SystemConfig } from '../model/system-config.ts';
import type { ConversationRepository, CustomerRepository } from '../repository/types.ts';
import type { ChatResult, ChatService } from './chat.ts';
import type { Notifier } from './notifier.ts';

export interface MessageResult {
  reply: string | null; // null = 刻意不回應(AI 暫停、超過頻率上限)
  failed?: unknown; // 處理失敗的原文。顧客已經收到保底訊息,這是給診斷用的
}

export interface MessageService {
  handleWebhook(client: MessagingClient, body: string): Promise<void>;
  handleMessage(incoming: IncomingMessage): Promise<MessageResult>;
}

const DAY_MS = 24 * 60 * 60_000;

export function createMessageService(
  systemConfig: SystemConfig, // properties
  customerRepository: CustomerRepository, // repository
  conversationRepository: ConversationRepository, // repository
  chatService: ChatService | null, // service
  notifier: Notifier, // service
): MessageService {
  return {
    async handleWebhook(client, body) {
      const messages = await client.parseMessages(body);

      await Promise.all(
        messages.map(async (message) => {
          const { reply } = await this.handleMessage(message);
          if (reply === null) return;

          await client.reply(message.replyTo, reply).catch((error) => {
            console.error(`${message.channel} 回復失敗:`, error);
          });
        }),
      );
    },
    async handleMessage(incoming: IncomingMessage): Promise<MessageResult> {
      const { channel, customerId, name, pictureUrl, text } = incoming;
      const receivedAt = Date.now();

      try {
        // 老闆接手中:沉默，連訊息都不存
        const customer = await customerRepository.findById(customerId);
        if (customer?.aiPausedUntil && customer.aiPausedUntil > receivedAt) return { reply: null };

        // 更新用戶資料
        await customerRepository.upsertProfile({ id: customerId, channel, name, pictureUrl });

        // 太頻繁就暫停他,這次也不回應
        if (await pauseIfTooFrequent(customerId, name)) return { reply: null };

        // 沒有可用的 AI(全部降級、或還沒設定)。不能沉默,顧客在等回應
        const result = chatService
          ? await chatService.ask(customerId, name, text, await loadHistory(customerId))
          : null;

        // AI 沒產出內容時改用保底訊息
        const reply = result?.reply || systemConfig.fallbackReply;

        await saveTurn(customerId, text, receivedAt, reply, result);

        return { reply };
      } catch (error) {
        console.error(`處理 ${channel} 訊息失敗:`, error);
        await notifier.systemError(`處理 ${channel} 訊息`, error);

        return { reply: systemConfig.fallbackReply, failed: error };
      }
    },
  };

  // 限制輪數並過濾太舊的訊息。設 0 輪代表停用記憶,不查資料庫
  function loadHistory(customerId: string) {
    const { historyTurns, historyDays } = systemConfig;
    if (historyTurns === 0) return Promise.resolve([]);

    return conversationRepository.getMessages(
      customerId,
      historyTurns * 2,
      Date.now() - historyDays * DAY_MS,
    );
  }

    // 顧客的話與我們的回覆一起寫,沒有 result 就是保底訊息
  async function saveTurn(
    customerId: string,
    text: string,
    receivedAt: number,
    reply: string,
    result: ChatResult | null,
  ) {
    await conversationRepository.appendMessages(customerId, [
      { role: 'user', content: text, timestamp: receivedAt },
      {
        role: result?.reply ? 'assistant' : 'fallback',
        content: reply,
        timestamp: Date.now(),
        provider: result?.provider,
        model: result?.model,
        trace: result?.trace ? JSON.stringify(result.trace) : null,
      },
    ]);
    await customerRepository.updateLastMessage(customerId, text, Date.now());
  }

  // 回 true 代表這次不該交給 AI。關閉時連查詢都不發
  async function pauseIfTooFrequent(customerId: string, name: string | null): Promise<boolean> {
    const { limitPauseMinutes, limitTurns, limitWindowMinutes, limitNotify } = systemConfig;
    if (limitPauseMinutes === 0) return false; // 0 = 沒有自動停用AI功能

    const since = Date.now() - limitWindowMinutes * 60_000;
    if ((await conversationRepository.countUserMessages(customerId, since)) < limitTurns) {
      return false;
    }

    await customerRepository.pauseAi(customerId, Date.now() + limitPauseMinutes * 60_000);
    if (limitNotify) await notifier.customerPaused(name ?? customerId, limitPauseMinutes);

    return true;
  }
}
