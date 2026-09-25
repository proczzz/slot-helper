import { useEffect, useState } from 'react';
import { getConfig, saveConfig } from '../lib/admin.ts';

const PROVIDERS = ['deepseek', 'anthropic'];

const KEY_FIELD: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

export function AiSettingsPage() {
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getConfig().then((config) => {
      const current = config.AI_PROVIDER ?? '';
      setProvider(current);
      setApiKey(config[KEY_FIELD[current] ?? ''] ?? '');
      setLoading(false);
    });
  }, []);

  function changeProvider(next: string) {
    setProvider(next);
    setApiKey('');
    setMessage('');
  }

  async function submit() {
    setMessage('');
    const ok = await saveConfig({
      AI_PROVIDER: provider,
      [KEY_FIELD[provider]!]: apiKey,
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
    <div className="card bg-base-100 shadow-sm max-w-md">
      <div className="card-body gap-4">
        <h2 className="card-title">AI 設定</h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">供應商</legend>
            <select
              className="select w-full"
              value={provider}
              onChange={(event) => changeProvider(event.target.value)}
            >
              <option value="">請選擇</option>
              {PROVIDERS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">API key</legend>
            <input
              type="password"
              className="input w-full"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={!provider}
            />
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={!provider || !apiKey}>
            儲存
          </button>
        </form>

        {message && <div className="alert">{message}</div>}
      </div>
    </div>
  );
}
