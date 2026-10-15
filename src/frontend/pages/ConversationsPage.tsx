import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ModelIcon } from '../components/BrandMark.tsx';
import { CustomerAvatar } from '../components/CustomerAvatar.tsx';
import { NewCustomerModal } from '../components/NewCustomerModal.tsx';
import {
  customerDisplayName,
  listCustomers,
  listMessages,
  pauseCustomerAi,
  sendTestMessage,
  type Customer,
  type Message,
  type ReplyTrace,
  type ToolCallRecord,
} from '../lib/admin.ts';

const EMPTY_TRACE: ReplyTrace = { tools: [] };

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
    hour12: false,
  });
}

// 清單用的短格式:越近的訊息給越細的資訊 —— 一行放得下才不會把名稱擠掉
function formatListTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1); // 跨月跨年由 Date 自己處理
  if (date.toDateString() === yesterday.toDateString()) return '昨天';

  if (date.getFullYear() !== now.getFullYear()) {
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' });
  }

  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
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
          className="flex-1 overflow-x-hidden overflow-y-auto"
          onScroll={(event) => onScrollNearBottom(event, customers)}
        >
          {customerList.length === 0 && !customers.isPending && (
            <p className="p-4 text-sm text-base-content/50">目前沒有對話</p>
          )}

          <ul className="flex w-full flex-col gap-1 p-2">
            {customerList.map((customer) => (
              <li key={customer.id} className="min-w-0">
                <button
                  type="button"
                  className={`flex w-full min-w-0 items-start gap-3 rounded-box px-3 py-2 text-left hover:bg-base-200 ${
                    selectedId === customer.id ? 'bg-base-300' : ''
                  }`}
                  onClick={() => select(customer.id)}
                >
                  <CustomerAvatar customer={customer} />

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{customerDisplayName(customer)}</span>
                    <span className="truncate text-xs text-base-content/60">
                      {customer.lastMessage}
                    </span>
                  </div>

                  <span className="w-12 shrink-0 text-right text-xs font-normal whitespace-nowrap text-base-content/50">
                    {customer.lastMessageAt === null ? '' : formatListTime(customer.lastMessageAt)}
                  </span>
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
            <div className="flex flex-wrap items-center gap-3 border-b border-base-200 p-4">
              <span className="font-semibold">{customerDisplayName(selected)}</span>
              <span className="badge badge-sm">{selected.channel}</span>
              <AiPauseControl customer={selected} />
            </div>

            {/* 訊息由新到舊載入，顯示時靠 flex-col-reverse 反轉，所以第一個子元素在最下面 */}
            <div
              className="flex flex-1 flex-col-reverse gap-3 overflow-y-auto p-4"
              onScroll={(event) => onScrollNearBottom(event, messages)}
            >
              {send.isPending && (
                <Bubble
                  role="user"
                  content={send.variables ?? ''}
                  customer={selected}
                  pending
                />
              )}

              {messageList.map((message) => (
                <Bubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  at={message.timestamp}
                  customer={selected}
                  model={message.model}
                  onInspect={message.role === 'user' ? undefined : () => setInspected(message)}
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

      {inspected && <ReplyDetailModal message={inspected} onClose={() => setInspected(null)} />}

      {loadError && (
        <div className="toast toast-end">
          <div className="alert alert-error">{loadError.message}</div>
        </div>
      )}
    </div>
  );
}

const PAUSE_OPTIONS = [
  { minutes: 60, label: '1 小時' },
  { minutes: 60 * 24, label: '1 天' },
  { minutes: 60 * 24 * 7, label: '1 週' },
];

// 暫停期間 AI 完全不回應這位顧客,由老闆自己接手。
// 刻意不回罐頭訊息 —— 老闆正在跟顧客對話時會一直被插話
function AiPauseControl({ customer }: { customer: Customer }) {
  const [minutes, setMinutes] = useState(PAUSE_OPTIONS[0]!.minutes);
  const queryClient = useQueryClient();

  const pause = useMutation({
    mutationFn: (next: number) => pauseCustomerAi(customer.id, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const until =
    customer.aiPausedUntil && customer.aiPausedUntil > Date.now() ? customer.aiPausedUntil : null;

  return (
    <div className="ml-auto flex items-center gap-2">
      {pause.isError && <span className="text-xs text-error">{pause.error.message}</span>}

      {until ? (
        <>
          <span className="badge badge-warning badge-sm">AI 暫停至 {formatTime(until)}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => pause.mutate(0)}
            disabled={pause.isPending}
          >
            {pause.isPending && <span className="loading loading-spinner loading-xs" />}
            恢復
          </button>
        </>
      ) : (
        <>
          <select
            className="select select-sm w-24"
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          >
            {PAUSE_OPTIONS.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => pause.mutate(minutes)}
            disabled={pause.isPending}
          >
            {pause.isPending && <span className="loading loading-spinner loading-xs" />}
            暫停 AI
          </button>
        </>
      )}
    </div>
  );
}

function Bubble({
  role,
  content,
  at,
  customer,
  model,
  pending,
  onInspect,
}: {
  role: Message['role'];
  content: string;
  at?: number;
  customer: Customer;
  model?: string | null;
  pending?: boolean;
  onInspect?: () => void;
}) {
  let bubbleColor = 'chat-bubble-primary';
  if (role === 'user') bubbleColor = '';
  else if (role === 'fallback') bubbleColor = 'chat-bubble-warning';

  return (
    <div
      className={`chat ${role === 'user' ? 'chat-start' : 'chat-end'} ${
        pending ? 'opacity-50' : ''
      }`}
    >
      <div className="chat-image">
        {role === 'user' ? (
          <CustomerAvatar customer={customer} className="size-8" />
        ) : (
          <div className="size-8 overflow-hidden rounded-full bg-base-200">
            <ModelIcon model={model ?? ''} className="size-full" cover />
          </div>
        )}
      </div>
      {at !== undefined && (
        <div className="chat-header text-xs opacity-60">
          {formatTime(at)}
          {role === 'fallback' && <span className="ml-2 text-warning">保底訊息</span>}
        </div>
      )}
      <div
        className={`chat-bubble whitespace-pre-wrap ${bubbleColor} ${
          onInspect ? 'cursor-pointer' : ''
        }`}
        onClick={onInspect}
      >
        {content}
      </div>
    </div>
  );
}

// 存進去的是 JSON 原文,壞掉的話寧可不顯示也不要讓整頁白畫面
function parseTrace(raw: string | null | undefined): ReplyTrace {
  if (!raw) return EMPTY_TRACE;
  try {
    const parsed = JSON.parse(raw) as ReplyTrace;
    return { tools: parsed.tools ?? [], reasoning: parsed.reasoning };
  } catch {
    return EMPTY_TRACE;
  }
}

function ReplyDetailModal({ message, onClose }: { message: Message; onClose: () => void }) {
  const trace = parseTrace(message.trace);
  // 把思考與工具按輪次交錯,才看得出「想了什麼 → 於是呼叫了什麼」
  const steps = [
    ...new Set([
      ...(trace.reasoning ?? []).map((item) => item.step),
      ...trace.tools.map((call) => call.step),
    ]),
  ].sort((a, b) => a - b);

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="text-lg font-bold">這則回覆的細節</h3>

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

        <h4 className="border-t border-base-200 pt-4 font-semibold">AI 的處理過程</h4>

        {steps.length === 0 ? (
          <p className="py-2 text-sm text-base-content/60">這則回覆沒有思考或工具紀錄。</p>
        ) : (
          <ol className="flex flex-col gap-3 py-2">
            {steps.map((step) => (
              <li key={step} className="flex flex-col gap-2">
                <span className="text-xs text-base-content/50">第 {step} 輪</span>

                {(trace.reasoning ?? [])
                  .filter((item) => item.step === step)
                  .map((item, index) => (
                    <details key={index} className="rounded-box bg-base-200 p-3">
                      <summary className="cursor-pointer text-sm">思考過程</summary>
                      <p className="mt-2 text-xs whitespace-pre-wrap text-base-content/70">
                        {item.text}
                      </p>
                    </details>
                  ))}

                {trace.tools
                  .filter((call) => call.step === step)
                  .map((call, index) => (
                    <ToolCallRow key={index} call={call} />
                  ))}
              </li>
            ))}
          </ol>
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

function ToolCallRow({ call }: { call: ToolCallRecord }) {
  let badge = <span className="badge badge-sm badge-success">成功</span>;
  if (call.error !== undefined) {
    badge = <span className="badge badge-sm badge-error">失敗</span>;
  } else if (call.output === undefined) {
    badge = <span className="badge badge-sm badge-warning">沒有結果</span>;
  }

  return (
    <div className="rounded-box bg-base-200 p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-mono text-sm">{call.name}</span>
        {badge}
      </div>

      {call.error !== undefined && (
        <p className="pt-2 text-sm whitespace-pre-wrap text-error">{call.error}</p>
      )}

      <details className="pt-2">
        <summary className="cursor-pointer text-xs text-base-content/60">參數與結果</summary>
        <pre className="mt-2 overflow-x-auto rounded-box bg-base-100 p-2 text-xs">
          {JSON.stringify({ input: call.input, output: call.output }, null, 2)}
        </pre>
      </details>
    </div>
  );
}
