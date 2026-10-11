import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NewCustomerModal } from '../components/NewCustomerModal.tsx';
import {
  customerDisplayName,
  listCustomers,
  listMessages,
  sendTestMessage,
  type Message,
} from '../lib/admin.ts';

const TEST_PREFIX = 'test:';

// 每頁筆數。不足一頁就代表沒有下一頁了
const CUSTOMERS_PAGE_SIZE = 20; // 送給後端,上限由 CustomerQuerySchema 夾住
const MESSAGES_PAGE_SIZE = 50; // 後端 admin/routes.ts 寫死的,這裡要跟著它

const CHANNELS = [
  { value: 'all', label: '全部' },
  { value: 'line', label: 'LINE' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'test', label: '測試' },
] as const;

type ChannelFilter = (typeof CHANNELS)[number]['value'];

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 捲到底就載下一批。只收真正需要的三個欄位
interface Pageable {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

function onScrollNearBottom(event: React.UIEvent<HTMLDivElement>, query: Pageable) {
  const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
  if (scrollHeight - scrollTop - clientHeight >= 80) return;
  if (!query.hasNextPage || query.isFetchingNextPage) return;
  query.fetchNextPage();
}

export function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [input, setInput] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  // 點開 AI 回覆要看是哪個模型產生的。先用 modal,未來 UI 再調整
  const [inspected, setInspected] = useState<Message | null>(null);
  const queryClient = useQueryClient();

  // channel 進 queryKey,所以每個過濾選項各自是一份 query、各自保有自己的分頁
  // 設定檔只有自己會改,對話紀錄顧客隨時會傳新訊息,所以不沿用全域的 staleTime: Infinity
  const customers = useInfiniteQuery({
    queryKey: ['customers', channel],
    queryFn: ({ pageParam }) =>
      listCustomers(
        CUSTOMERS_PAGE_SIZE,
        pageParam ?? undefined,
        channel === 'all' ? undefined : channel,
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < CUSTOMERS_PAGE_SIZE
        ? undefined
        : (lastPage[lastPage.length - 1]?.lastMessageAt ?? undefined),
    staleTime: 0,
  });

  const messages = useInfiniteQuery({
    queryKey: ['messages', selectedId],
    // enabled 擋住 null,這裡不會收到空的 selectedId
    queryFn: ({ pageParam }) => listMessages(selectedId!, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGES_PAGE_SIZE
        ? undefined
        : (lastPage[lastPage.length - 1]?.id ?? undefined),
    enabled: selectedId !== null,
    staleTime: 0,
  });

  const send = useMutation({
    mutationFn: (text: string) => sendTestMessage(selectedId!.slice(TEST_PREFIX.length), text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      // 後端存完訊息會更新 last_message,左側清單要跟著重抓
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const customerList = customers.data?.pages.flat() ?? [];
  const messageList = messages.data?.pages.flat() ?? [];
  const selected = customerList.find((customer) => customer.id === selectedId) ?? null;
  const loadError = customers.error ?? messages.error ?? send.error;

  function select(customerId: string) {
    setSelectedId(customerId);
    setInput('');
    send.reset();
  }

  function changeChannel(next: ChannelFilter) {
    setChannel(next);
    // 選中的顧客可能不在新的清單裡,直接清掉比讓右側莫名變空好
    setSelectedId(null);
  }

  function submitMessage() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    send.mutate(text);
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] gap-4">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-box bg-base-100 shadow-sm">
        <div className="flex items-center gap-2 border-b border-base-200 p-3">
          <select
            className="select select-sm flex-1"
            value={channel}
            onChange={(event) => changeChannel(event.target.value as ChannelFilter)}
          >
            {CHANNELS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-sm btn-square"
            onClick={() => setShowNewCustomer(true)}
            aria-label="新增測試顧客"
          >
            ＋
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto"
          onScroll={(event) => onScrollNearBottom(event, customers)}
        >
          {customerList.length === 0 && !customers.isPending && (
            <p className="p-4 text-sm text-base-content/50">目前沒有對話</p>
          )}

          <ul className="menu w-full gap-1 p-2">
            {customerList.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className={`flex items-start gap-3 ${
                    selectedId === customer.id ? 'menu-active' : ''
                  }`}
                  onClick={() => select(customer.id)}
                >
                  <div className="avatar">
                    <div className="size-9 rounded-full bg-base-300">
                      {customer.pictureUrl && (
                        <img src={customer.pictureUrl} alt="" referrerPolicy="no-referrer" />
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{customerDisplayName(customer)}</span>
                    <span className="truncate text-xs text-base-content/60">
                      {customer.lastMessage}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {(customers.isPending || customers.isFetchingNextPage) && (
            <div className="flex justify-center p-4">
              <span className="loading loading-spinner loading-sm" />
            </div>
          )}
        </div>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden rounded-box bg-base-100 shadow-sm">
        {!selected ? (
          <div className="grid flex-1 place-items-center text-base-content/50">
            從左側選擇一位顧客
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-base-200 p-4">
              <span className="font-semibold">{customerDisplayName(selected)}</span>
              <span className="badge badge-sm">{selected.channel}</span>
            </div>

            {/* 訊息由新到舊載入，顯示時靠 flex-col-reverse 反轉，所以第一個子元素在最下面 */}
            <div
              className="flex flex-1 flex-col-reverse gap-3 overflow-y-auto p-4"
              onScroll={(event) => onScrollNearBottom(event, messages)}
            >
              {send.isPending && <Bubble role="user" content={send.variables ?? ''} pending />}

              {messageList.map((message) => (
                <Bubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  at={message.timestamp}
                  onInspect={
                    message.role === 'assistant' ? () => setInspected(message) : undefined
                  }
                />
              ))}

              {(messages.isPending || messages.isFetchingNextPage) && (
                <div className="flex justify-center p-4">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              )}

              {!messages.hasNextPage && messageList.length > 0 && (
                <p className="py-2 text-center text-xs text-base-content/40">沒有更早的訊息了</p>
              )}
            </div>

            {send.isSuccess && send.data === '' && (
              <div className="alert alert-warning mx-3 mb-0 w-auto">
                AI 沒有回覆內容，這則訊息沒有被記錄。日曆可能已經被改動，請自行確認。
              </div>
            )}

            {selected.channel === 'test' && (
              <form
                className="flex gap-2 border-t border-base-200 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitMessage();
                }}
              >
                <input
                  type="text"
                  className="input flex-1"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="以這位顧客的身分傳送訊息"
                  disabled={send.isPending}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={send.isPending || !input.trim()}
                >
                  {send.isPending && <span className="loading loading-spinner loading-xs" />}
                  送出
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {showNewCustomer && <NewCustomerModal onClose={() => setShowNewCustomer(false)} />}

      {inspected && <ModelModal message={inspected} onClose={() => setInspected(null)} />}

      {loadError && (
        <div className="toast toast-end">
          <div className="alert alert-error">{loadError.message}</div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  role,
  content,
  at,
  pending,
  onInspect,
}: {
  role: Message['role'];
  content: string;
  at?: number;
  pending?: boolean;
  onInspect?: () => void;
}) {
  return (
    <div
      className={`chat ${role === 'user' ? 'chat-start' : 'chat-end'} ${
        pending ? 'opacity-50' : ''
      }`}
    >
      {at !== undefined && <div className="chat-header text-xs opacity-60">{formatTime(at)}</div>}
      <div
        className={`chat-bubble whitespace-pre-wrap ${role === 'user' ? '' : 'chat-bubble-primary'} ${
          onInspect ? 'cursor-pointer' : ''
        }`}
        onClick={onInspect}
      >
        {content}
      </div>
    </div>
  );
}

function ModelModal({ message, onClose }: { message: Message; onClose: () => void }) {
  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">這則回覆由誰產生</h3>

        {message.provider ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 py-4 text-sm">
            <dt className="text-base-content/60">供應商</dt>
            <dd className="font-mono">{message.provider}</dd>
            <dt className="text-base-content/60">模型</dt>
            <dd className="font-mono break-all">{message.model}</dd>
            <dt className="text-base-content/60">時間</dt>
            <dd>{formatTime(message.timestamp)}</dd>
          </dl>
        ) : (
          <p className="py-4 text-sm text-base-content/60">
            這則訊息沒有記錄模型資訊，是加入這個功能之前存下的。
          </p>
        )}

        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
