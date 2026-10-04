import { useEffect, useRef, useState } from 'react';
import {
  createTestCustomer,
  customerDisplayName,
  listCustomers,
  listMessages,
  sendTestMessage,
  type Customer,
  type Message,
} from '../lib/admin.ts';

const TEST_PREFIX = 'test:';

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
  const [filter, setFilter] = useState<'all' | 'line' | 'test'>('all');
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesDone, setMessagesDone] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    void loadCustomers(true);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setMessages([]);
    setMessagesDone(false);
    setInput('');
    void loadMessages(selected.id, true);
  }, [selected?.id]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(timer);
  }, [error]);

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
      // 訊息由新到舊載入，顯示時靠 flex-col-reverse 反轉
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

  async function send() {
    if (!selected || !input.trim()) return;

    const text = input.trim();
    setInput('');
    setSending(true);

    // 先顯示出去，等 AI 回覆後重新抓取真實資料
    setMessages((current) => [
      { id: Date.now(), role: 'user', content: text, timestamp: Date.now() },
      ...current,
    ]);

    try {
      await sendTestMessage(selected.id.slice(TEST_PREFIX.length), text);
      await loadMessages(selected.id, true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '傳送失敗');
    } finally {
      setSending(false);
    }
  }

  // 捲到底就載入下一批
  function onScroll(event: React.UIEvent<HTMLDivElement>, loadMore: () => void) {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 80) loadMore();
  }

  const visibleCustomers = customers.filter(
    (customer) => filter === 'all' || customer.channel === filter,
  );

  return (
    <div className="flex h-[calc(100dvh-8rem)] gap-4">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-box bg-base-100 shadow-sm">
        <div className="flex items-center gap-2 border-b border-base-200 p-3">
          <select
            className="select select-sm flex-1"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="all">全部</option>
            <option value="line">LINE</option>
            <option value="test">測試</option>
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
          onScroll={(event) => onScroll(event, () => void loadCustomers(false))}
        >
          {visibleCustomers.length === 0 && !loadingCustomers && (
            <p className="p-4 text-sm text-base-content/50">目前沒有對話</p>
          )}

          <ul className="menu w-full gap-1 p-2">
            {visibleCustomers.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  className={`flex items-start gap-3 ${
                    selected?.id === customer.id ? 'menu-active' : ''
                  }`}
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

            {selected.channel === 'test' && (
              <form
                className="flex gap-2 border-t border-base-200 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <input
                  type="text"
                  className="input flex-1"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="以這位顧客的身分傳送訊息"
                  disabled={sending}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending || !input.trim()}
                >
                  {sending && <span className="loading loading-spinner loading-xs" />}
                  送出
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={() => {
            setShowNewCustomer(false);
            void loadCustomers(true);
          }}
        />
      )}

      {error && (
        <div className="toast toast-end">
          <div className="alert alert-error">{error}</div>
        </div>
      )}
    </div>
  );
}

function NewCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true);
    try {
      await createTestCustomer(id, name);
      onCreated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '建立失敗');
      setSaving(false);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">新增測試顧客</h3>

        <form
          className="flex flex-col gap-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">識別碼</legend>
            <input
              type="text"
              className="input w-full"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="alice"
              autoFocus
            />
            <p className="label">用來區分不同測試身分，會存成 test:alice</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">名稱</legend>
            <input
              type="text"
              className="input w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="王小姐"
            />
          </fieldset>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !id || !name}>
              {saving && <span className="loading loading-spinner loading-xs" />}
              建立
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
