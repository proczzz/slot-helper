import { useEffect, useState } from 'react';
import { getConfig, saveConfig } from '../lib/admin.ts';

export function LineSettingsPage() {
  const [channelSecret, setChannelSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const webhookUrl = `${window.location.origin}/line/webhook`;

  useEffect(() => {
    getConfig().then((config) => {
      setChannelSecret(config.LINE_CHANNEL_SECRET ?? '');
      setAccessToken(config.LINE_CHANNEL_ACCESS_TOKEN ?? '');
      setLoading(false);
    });
  }, []);

  async function submit() {
    setMessage('');
    const ok = await saveConfig({
      LINE_CHANNEL_SECRET: channelSecret,
      LINE_CHANNEL_ACCESS_TOKEN: accessToken,
    });
    setMessage(ok ? '已儲存' : '儲存失敗');
  }

  if (loading) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-sm max-w-2xl">
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
          <p className="label">貼到 LINE Developers 的 Webhook URL,並開啟 Use webhook</p>
        </fieldset>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
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
              className="textarea w-full font-mono text-xs"
              rows={4}
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
            />
          </fieldset>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!channelSecret || !accessToken}
          >
            儲存
          </button>
        </form>

        {message && <div className="alert">{message}</div>}
      </div>
    </div>
  );
}
