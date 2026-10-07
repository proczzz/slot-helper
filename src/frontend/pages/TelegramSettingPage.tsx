import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getSection,
  saveSection,
  sendTelegramTest,
  type TelegramConfig,
} from '../lib/admin.ts';

const EMPTY: TelegramConfig = { botToken: '', chatId: '' };

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

  // 資料到齊才掛載表單,初始值直接交給 useState,不需要再用 useEffect 同步
  return <TelegramForm config={data ?? EMPTY} />;
}

function TelegramForm({ config }: { config: TelegramConfig }) {
  const [botToken, setBotToken] = useState(config.botToken);
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
            save.mutate({ botToken, chatId });
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Bot token</legend>
            <input
              type="password"
              className="input w-full"
              value={botToken}
              onChange={(event) => setBotToken(event.target.value)}
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
              disabled={save.isPending || !botToken || !chatId || chatIdInvalid}
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
                botToken !== config.botToken ||
                chatId !== config.chatId
              }
              onClick={() => test.mutate()}
            >
              {test.isPending && <span className="loading loading-spinner" />}
              發送測試訊息
            </button>
          </div>
        </form>

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
