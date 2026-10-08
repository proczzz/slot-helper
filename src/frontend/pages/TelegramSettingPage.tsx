import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getSection,
  getTelegramWebhook,
  registerTelegramWebhook,
  saveSection,
  sendTelegramTest,
  type TelegramConfig,
  type WebhookInfo,
} from '../lib/admin.ts';

const EMPTY: TelegramConfig = { accessToken: '', chatId: '', webhookSecret: '' };

export function TelegramSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'telegram'],
    queryFn: () => getSection<TelegramConfig>('telegram'),
  });

  if (isPending) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="alert alert-error max-w-2xl">
        <span>{error.message}</span>
      </div>
    );
  }

  // 資料到齊才掛載表單,初始值直接交給 useState,不需要再用 useEffect 同步。
  // 後端的 GET 回的是原樣存進去的 JSON、不套 schema,所以舊資料可能缺欄位,用 EMPTY 補齊
  return <TelegramForm config={{ ...EMPTY, ...data }} />;
}

function TelegramForm({ config }: { config: TelegramConfig }) {
  const [accessToken, setAccessToken] = useState(config.accessToken);
  const [chatId, setChatId] = useState(config.chatId);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: TelegramConfig) => saveSection('telegram', next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'telegram'] });
    },
  });

  const test = useMutation({ mutationFn: sendTelegramTest });

  useAutoReset(save);
  useAutoReset(test);

  // 後端的 schema 也是這條規則,先在前端擋住可以少一次往返
  const chatIdInvalid = chatId.length > 0 && !/^-?\d+$/.test(chatId);

  return (
    <div className="card max-w-2xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">Telegram 設定</h2>
        <p className="text-sm opacity-70">AI 遇到無法處理的顧客需求時，會透過這個機器人通知你。</p>

        <div className="alert alert-info text-sm">
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              在 Telegram 裡找 <span className="font-mono">@BotFather</span>，送{' '}
              <span className="font-mono">/newbot</span>，取得 Bot token
            </li>
            <li>點開你的新機器人，按一次「開始」 —— 沒做這步機器人無法發訊息給你</li>
            <li>
              找 <span className="font-mono">@userinfobot</span> 說一句話，複製它回覆的 Id
            </li>
          </ol>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // 驗證碼是伺服器狀態、老闆不編輯,所以直接沿用目前設定裡的值。
            // 放進 useState 的話,註冊 webhook 之後會停在舊值、按儲存就把新的洗掉
            save.mutate({ accessToken, chatId, webhookSecret: config.webhookSecret });
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Bot token</legend>
            <input
              type="password"
              className="input w-full"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              spellCheck={false}
            />
            <p className="label">BotFather 給的那一串，格式像 123456789:AAH...</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Chat ID</legend>
            <input
              type="text"
              className={`input w-full ${chatIdInvalid ? 'input-error' : ''}`}
              value={chatId}
              onChange={(event) => setChatId(event.target.value)}
              spellCheck={false}
            />
            {chatIdInvalid ? (
              <p className="label text-error">Chat ID 必須是數字</p>
            ) : (
              <p className="label">要收通知的帳號，群組的話是負數</p>
            )}
          </fieldset>

          <div className="flex gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={save.isPending || !accessToken || !chatId || chatIdInvalid}
            >
              {save.isPending && <span className="loading loading-spinner" />}
              儲存
            </button>

            {/* 測試用的是後端已儲存的設定,所以改過還沒存時先擋住,免得以為在測新的值 */}
            <button
              type="button"
              className="btn"
              disabled={
                test.isPending ||
                save.isPending ||
                accessToken !== config.accessToken ||
                chatId !== config.chatId
              }
              onClick={() => test.mutate()}
            >
              {test.isPending && <span className="loading loading-spinner" />}
              發送測試訊息
            </button>
          </div>
        </form>

        <WebhookSection enabled={config.accessToken.length > 0 && config.chatId.length > 0} />

        {test.isError && (
          <div className="alert alert-error">
            <span className="whitespace-pre-wrap text-sm">{test.error.message}</span>
          </div>
        )}

        {save.isSuccess && (
          <div className="toast toast-end">
            <div className="alert alert-success">已儲存</div>
          </div>
        )}

        {test.isSuccess && (
          <div className="toast toast-end">
            <div className="alert alert-success">已發送，請看 Telegram</div>
          </div>
        )}

        {save.isError && (
          <div className="toast toast-end">
            <div className="alert alert-error">{save.error.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function WebhookSection({ enabled }: { enabled: boolean }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['telegram-webhook'],
    queryFn: getTelegramWebhook,
    enabled,
  });

  if (!enabled) {
    return (
      <Section>
        <p className="label">先填好上面的設定並儲存，才能註冊 Webhook</p>
      </Section>
    );
  }

  if (isPending) {
    return (
      <Section>
        <span className="loading loading-spinner loading-sm" />
      </Section>
    );
  }

  if (isError) {
    return (
      <Section>
        <div className="alert alert-error">
          <span className="text-sm">{error.message}</span>
        </div>
      </Section>
    );
  }

  // 資料到齊才掛載,輸入框的初始值才拿得到 Telegram 目前註冊的網址
  return <WebhookForm info={data} />;
}

function Section({ children }: { children: ReactNode }) {
  return (
    <fieldset className="fieldset border-t border-base-300 pt-4">
      <legend className="fieldset-legend">Telegram 指令</legend>
      {children}
    </fieldset>
  );
}

function WebhookForm({ info }: { info: WebhookInfo | null }) {
  const queryClient = useQueryClient();

  // 後台所在的網域。大多數部署這就是對外網域,但內網後台或反向代理底下不是
  const localUrl = `${window.location.origin}/telegram/webhook`;
  // 已經註冊過就沿用 Telegram 記著的值,否則按一次註冊就會把原本能用的網址換掉
  const [url, setUrl] = useState(info?.url || localUrl);
  const custom = url !== localUrl;

  const register = useMutation({
    mutationFn: () => registerTelegramWebhook(url),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['telegram-webhook'] });
    },
  });

  return (
    <Section>
      <div className="join w-full">
        <input
          type="url"
          className={`input join-item w-full font-mono text-xs ${custom ? 'input-warning' : ''}`}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          spellCheck={false}
        />
        <button
          type="button"
          className="btn join-item"
          disabled={!custom}
          onClick={() => setUrl(localUrl)}
        >
          還原
        </button>
      </div>

      {custom ? (
        <p className="label text-warning">
          這不是你現在瀏覽後台的網域。內網後台或反向代理底下這是正常的；不是故意改的話按「還原」
        </p>
      ) : (
        <p className="label">Telegram 必須連得到這個網址，所以要是公開的 HTTPS</p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="btn"
          disabled={register.isPending || !url}
          onClick={() => register.mutate()}
        >
          {register.isPending && <span className="loading loading-spinner" />}
          註冊 Webhook
        </button>

        {info?.url ? (
          <span className="badge badge-success badge-soft">已註冊</span>
        ) : (
          <span className="badge badge-ghost">未註冊</span>
        )}
      </div>

      {info?.url && <p className="label font-mono text-xs break-all">目前註冊：{info.url}</p>}

      {register.isError && (
        <div className="alert alert-error mt-2">
          <span className="whitespace-pre-wrap text-sm">{register.error.message}</span>
        </div>
      )}

      {/* Telegram 打不進來時原因只會出現在這裡,所以不放 toast,也不自動消失 */}
      {info?.lastErrorMessage && (
        <div className="alert alert-warning mt-2">
          <span className="text-sm">
            Telegram 上次送達失敗：{info.lastErrorMessage}
            {info.lastErrorAt && `（${new Date(info.lastErrorAt).toLocaleString()}）`}
          </span>
        </div>
      )}

      {info && info.pendingUpdateCount > 0 && (
        <p className="label text-warning">有 {info.pendingUpdateCount} 筆更新還沒被處理</p>
      )}
    </Section>
  );
}
