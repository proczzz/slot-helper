import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import { getSection, saveSection, type LineConfig } from '../lib/admin.ts';

const EMPTY: LineConfig = { channelSecret: '', accessToken: '' };

export function LineSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'line'],
    queryFn: () => getSection<LineConfig>('line'),
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
  return <LineForm config={data ?? EMPTY} />;
}

function LineForm({ config }: { config: LineConfig }) {
  const [channelSecret, setChannelSecret] = useState(config.channelSecret);
  const [accessToken, setAccessToken] = useState(config.accessToken);
  const queryClient = useQueryClient();

  const webhookUrl = `${window.location.origin}/line/webhook`;

  const save = useMutation({
    // saveSection 把錯誤當成回傳值,這裡轉成 throw 才走得到 onError
    mutationFn: async (next: LineConfig) => {
      const failure = await saveSection('line', next);
      if (failure) throw new Error(failure);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'line'] });
    },
  });

  useAutoReset(save);

  return (
    <div className="card max-w-2xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">LINE 設定</h2>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Webhook 網址</legend>
          <div className="join w-full">
            <input type="text" className="input join-item w-full" value={webhookUrl} readOnly />
            <button
              type="button"
              className="btn join-item"
              onClick={() => void navigator.clipboard.writeText(webhookUrl)}
            >
              複製
            </button>
          </div>
          <p className="label">貼到 LINE Developers 的 Webhook URL，並開啟 Use webhook</p>
        </fieldset>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ channelSecret, accessToken });
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Channel secret</legend>
            <input
              type="password"
              className="input w-full"
              value={channelSecret}
              onChange={(event) => setChannelSecret(event.target.value)}
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Channel access token</legend>
            <textarea
              className="textarea textarea-bordered w-full font-mono text-xs"
              rows={4}
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              spellCheck={false}
            />
          </fieldset>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending || !channelSecret || !accessToken}
          >
            {save.isPending && <span className="loading loading-spinner" />}
            儲存
          </button>
        </form>

        {save.isSuccess && (
          <div className="toast toast-end">
            <div className="alert alert-success">已儲存</div>
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
