import { ExpectedError } from '../core/app-error.ts';
import type { ChatService } from '../core/chat-service.ts';
import type { Customer } from '../model/entity/customer.ts';
import type { Message } from '../model/entity/message.ts';
import type { ChatResponse } from '../model/dto/chat.ts';
import type { ConversationRepository, CustomerRepository } from '../repository/types.ts';

// 測試顧客用這個 channel 與其他管道隔開
const TEST_CHANNEL = 'test';
const MESSAGE_PAGE_SIZE = 50;

export interface CustomerService {
  list(limit: number, before?: number, channel?: string): Promise<Customer[]>;
  messages(customerId: string, before: number | null): Promise<Message[]>;
  pauseAi(customerId: string, minutes: number): Promise<void>;
  upsertTestCustomer(id: string, name: string): Promise<void>;
  testChat(sessionId: string, message: string): Promise<ChatResponse>;
}

export function createCustomerService(
  customerRepository: CustomerRepository, // repository
  conversationRepository: ConversationRepository, // repository
  testChatService: ChatService | null, // service
): CustomerService {
  return {
    list(limit, before, channel) {
      return customerRepository.list(limit, before, channel);
    },

    messages(customerId, before) {
      return conversationRepository.listMessages(customerId, before, MESSAGE_PAGE_SIZE);
    },

    pauseAi(customerId, minutes) {
      // minutes 傳 0 代表恢復
      return customerRepository.pauseAi(
        customerId,
        minutes > 0 ? Date.now() + minutes * 60_000 : null,
      );
    },

    upsertTestCustomer(id, name) {
      return customerRepository.upsertProfile({
        id: `${TEST_CHANNEL}:${id}`,
        channel: TEST_CHANNEL,
        name,
        pictureUrl: null,
      });
    },

    async testChat(sessionId, message) {
      if (!testChatService) throw new ExpectedError('AI 尚未設定，請先儲存設定');

      const id = `${TEST_CHANNEL}:${sessionId}`;
      const customer = await customerRepository.findById(id);
      if (!customer) throw new ExpectedError('找不到這個測試身分，請先建立');

      const result = await testChatService.handleChat(id, customer.name, message);
      await customerRepository.updateLastMessage(id, message, Date.now());

      return result;
    },
  };
}
