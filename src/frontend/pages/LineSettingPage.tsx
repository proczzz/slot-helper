import { useEffect, useState } from 'react';
import { getLineConfig, saveLineConfig } from '../lib/admin.ts';

export function LineSettingsPage() {
  const [channelSecret, setChannelSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const webhookUrl = `${window.location.origin}/line/webhook`;

  useEffect(() => {
    getLineConfig().then((config) => {
      setChannelSecret(config?.channelSecret ?? '');
      setAccessToken(config?.accessToken ?? '');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  async function submit() {
    setSaving(true);
    const error = await saveLineConfig({ channelSecret, accessToken });
    setSaving(false);
    setMessage(error ?? '已儲存');
  }

  if (loading) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

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
            disabled={saving || !channelSecret || !accessToken}
          >
            {saving && <span className="loading loading-spinner" />}
            儲存
          </button>
        </form>

        {message && (
          <div className="toast toast-end">
            <div className="alert">{message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
