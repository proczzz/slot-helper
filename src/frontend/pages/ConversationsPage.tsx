import { useEffect, useRef, useState } from 'react';
import {
  customerDisplayName,
  listCustomers,
  listMessages,
  type Customer,
  type Message,
} from '../lib/admin.ts';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConversationsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersDone, setCustomersDone] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesDone, setMessagesDone] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    void loadCustomers(true);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setMessages([]);
    setMessagesDone(false);
    void loadMessages(selected.id, true);
  }, [selected?.id]);

  async function loadCustomers(reset: boolean) {
    if (busy.current || (!reset && customersDone)) return;
    busy.current = true;
    setLoadingCustomers(true);

    try {
      const cursor = reset ? null : (customers[customers.length - 1]?.lastMessageAt ?? null);
      const next = await listCustomers(cursor);
      setCustomers((current) => (reset ? next : [...current, ...next]));
      setCustomersDone(next.length === 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '載入失敗');
    } finally {
      busy.current = false;
      setLoadingCustomers(false);
    }
  }

  async function loadMessages(customerId: string, reset: boolean) {
    if (busy.current || (!reset && messagesDone)) return;
    busy.current = true;
    setLoadingMessages(true);

    try {
      // 訊息由新到舊載入，顯示時才反轉
      const cursor = reset ? null : (messages[messages.length - 1]?.id ?? null);
      const next = await listMessages(customerId, cursor);
      setMessages((current) => (reset ? next : [...current, ...next]));
      setMessagesDone(next.length === 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '載入失敗');
    } finally {
      busy.current = false;
      setLoadingMessages(false);
    }
  }

  // 捲到底就載入下一批
  function onScroll(event: React.UIEvent<HTMLDivElement>, loadMore: () => void) {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 80) loadMore();
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] gap-4">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-box bg-base-100 shadow-sm">
        <div className="border-b border-base-200 p-4 font-semibold">對話紀錄</div>

        <div
          className="flex-1 overflow-y-auto"
          onScroll={(event) => onScroll(event, () => void loadCustomers(false))}
        >
          {customers.length === 0 && !loadingCustomers && (
            <p className="p-4 text-sm text-base-content/50">目前沒有對話</p>
          )}

          <ul className="menu w-full gap-1 p-2">
            {customers.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className={`flex items-start gap-3 ${selected?.id === customer.id ? 'menu-active' : ''}`}
                  onClick={() => setSelected(customer)}
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

          {loadingCustomers && (
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

            <div
              className="flex flex-1 flex-col-reverse gap-3 overflow-y-auto p-4"
              onScroll={(event) => onScroll(event, () => void loadMessages(selected.id, false))}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat ${message.role === 'user' ? 'chat-start' : 'chat-end'}`}
                >
                  <div className="chat-header text-xs opacity-60">
                    {formatTime(message.timestamp)}
                  </div>
                  <div
                    className={`chat-bubble whitespace-pre-wrap ${
                      message.role === 'user' ? '' : 'chat-bubble-primary'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {loadingMessages && (
                <div className="flex justify-center p-4">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              )}

              {messagesDone && messages.length > 0 && (
                <p className="py-2 text-center text-xs text-base-content/40">沒有更早的訊息了</p>
              )}
            </div>
          </>
        )}
      </section>

      {error && (
        <div className="toast toast-end">
          <div className="alert alert-error">{error}</div>
        </div>
      )}
    </div>
  );
}
