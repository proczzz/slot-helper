import type { Customer } from '../model/entity/customer.ts';
import type { Message } from '../model/entity/message.ts';
import type { ConversationRepository, CustomerRepository } from '../repository/types.ts';

// 測試顧客用這個 channel 與其他管道隔開
const TEST_CHANNEL = 'test';
const MESSAGE_PAGE_SIZE = 50;

export interface CustomerService {
  list(limit: number, before?: number, channel?: string): Promise<Customer[]>;
  messages(customerId: string, before: number | null): Promise<Message[]>;
  pauseAi(customerId: string, minutes: number): Promise<void>;
  upsertTestCustomer(id: string, name: string): Promise<void>;
}

export function createCustomerService(
  customerRepository: CustomerRepository, // repository
  conversationRepository: ConversationRepository, // repository
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
  };
}
