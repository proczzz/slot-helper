import type { IncomingMessage, MessagingClient } from '../adapter/types.ts';
import { logError } from '../core/log.ts';
import { toLocalClock } from '../core/time.ts';
import type { Customer } from '../model/entity/customer.ts';
import type { Message } from '../model/entity/message.ts';
import type { ShopConfig } from '../model/shop-config.ts';
import type { SystemConfig } from '../model/system-config.ts';
import type { ConversationRepository, CustomerRepository } from '../repository/types.ts';
import type { ChatService } from './chat.ts';
import type { Notifier } from './notifier.ts';

export interface MessageResult {
  reply: string | null; // null = 刻意不回應(老闆接手中、或暫停期間的後續訊息)
  failed?: unknown; // 處理失敗的原文。顧客已經收到保底訊息,這是給診斷用的
}

export interface MessageService {
  handleWebhook(client: MessagingClient, body: string): Promise<void>;
  handleMessage(incoming: IncomingMessage): Promise<MessageResult>;
}

// 會進 AI 記憶的角色。orphan 與 notice 不給 AI 看
const MEMORY_ROLES: Message['role'][] = ['user', 'assistant', 'fallback'];
const DAY_MS = 24 * 60 * 60_000;

export function createMessageService(
  systemConfig: SystemConfig, // properties
  shopConfig: ShopConfig, // properties
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
            logError(`${message.channel} 回復失敗:`, error);
          });
        }),
      );
    },
    async handleMessage(incoming: IncomingMessage): Promise<MessageResult> {
      const { channel, customerId, name, pictureUrl, text } = incoming;
      const receivedAt = Date.now();

      try {
        const customer = await customerRepository.findById(customerId);
        // 老闆接手中或暫停中:AI 沉默,但顧客說的話要留下
        if (customer?.aiPausedUntil && customer.aiPausedUntil > receivedAt) {
          await saveMessages(customerId, text, [
            { role: 'orphan', content: text, timestamp: receivedAt },
          ]);
          return { reply: null };
        }

        // (若資料有變更名稱、頭貼)更新用戶資料
        if (profileChanged(customer, incoming)) {
          await customerRepository.upsertProfile({ id: customerId, channel, name, pictureUrl });
        }
        // 太頻繁就暫停他。只有觸發的這一則會收到通知,之後的都落在上面那個分支
        const pausedUntil = await pauseIfTooFrequent(customerId, name);
        if (pausedUntil !== null) {
          const notice = `訊息太頻繁了，我需要休息一下，${toLocalClock(pausedUntil, shopConfig.timeZone)} 後再為您服務`;

          await saveMessages(customerId, text, [
            { role: 'orphan', content: text, timestamp: receivedAt },
            { role: 'notice', content: notice, timestamp: Date.now() },
          ]);
          return { reply: notice };
        }

        // 沒有可用的 AI(全部降級、或還沒設定)。不能沉默,顧客在等回應
        const result = chatService
          ? await chatService.ask(customerId, name, text, await loadHistory(customerId))
          : null;

        if (result?.failed && !result.reported) {
          await notifier.systemError('AI 無法回應', result.failed);
        }
        // AI 沒產出內容時改用保底訊息
        const reply = result?.reply || systemConfig.fallbackReply;

        await saveMessages(customerId, text, [
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

        return { reply };
      } catch (error) {
        logError(`處理 ${channel} 訊息失敗:`, error);
        await notifier.systemError(`處理 ${channel} 訊息`, error);

        // 補登。失敗就算了,原本那個錯誤比較重要
        await saveMessages(customerId, text, [
          { role: 'user', content: text, timestamp: receivedAt },
          { role: 'fallback', content: systemConfig.fallbackReply, timestamp: Date.now() },
        ]).catch((saveError) => logError('補登對話失敗:', saveError));

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
      MEMORY_ROLES,
    );
  }

  // 寫入這一輪的訊息，並更新顧客最後活動時間
  async function saveMessages(customerId: string, text: string, messages: Message[]) {
    await conversationRepository.appendMessages(customerId, messages);
    await customerRepository.updateLastMessage(customerId, text, Date.now());
  }

  // 回恢復時間代表這次不該交給 AI,null 是正常。關閉時連查詢都不發
  async function pauseIfTooFrequent(
    customerId: string,
    name: string | null,
  ): Promise<number | null> {
    const { limitPauseMinutes, limitTurns, limitWindowMinutes, limitNotify } = systemConfig;
    if (limitPauseMinutes === 0) return null; // 0 = 沒有自動停用AI功能

    const since = Date.now() - limitWindowMinutes * 60_000;
    if ((await conversationRepository.countUserMessages(customerId, since)) < limitTurns) {
      return null;
    }

    const until = Date.now() + limitPauseMinutes * 60_000;
    await customerRepository.pauseAi(customerId, until);
    if (limitNotify) await notifier.customerPaused(name ?? customerId, limitPauseMinutes);

    return until;
  }

  // upsertProfile 用 COALESCE,傳 null 代表保留原值,所以 null 不算變更
  function profileChanged(customer: Customer | null, incoming: IncomingMessage): boolean {
    if (customer === null) return true;

    return (
      customer.channel !== incoming.channel ||
      (incoming.name !== null && customer.name !== incoming.name) ||
      (incoming.pictureUrl !== null && customer.pictureUrl !== incoming.pictureUrl)
    );
  }
}
