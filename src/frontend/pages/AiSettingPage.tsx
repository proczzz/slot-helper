import { useEffect, useState } from 'react';
import { getSection, saveSection } from '../lib/admin.ts';

const PROVIDERS = ['deepseek', 'anthropic'];

interface AiKey {
  name: string;
  provider: string;
  apiKey: string;
  model: string;
}

const EMPTY: AiKey = { name: '', provider: '', apiKey: '', model: '' };

export function AiSettingsPage() {
  const [key, setKey] = useState<AiKey>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getSection<AiKey[]>('ai').then((keys) => {
      setKey(keys?.[0] ?? EMPTY);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  function update(field: keyof AiKey, value: string) {
    setKey({ ...key, [field]: value });
  }

  async function submit() {
    setSaving(true);
    const error = await saveSection('ai', [key]);
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

  const canSubmit = key.name && key.provider && key.apiKey && key.model;

  return (
    <div className="card max-w-md bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">AI 模型</h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">名稱</legend>
            <input
              type="text"
              className="input w-full"
              value={key.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="自己辨識用，例如「主力」"
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">供應商</legend>
            <select
              className="select w-full"
              value={key.provider}
              onChange={(event) => update('provider', event.target.value)}
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
              value={key.apiKey}
              onChange={(event) => update('apiKey', event.target.value)}
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">模型</legend>
            <input
              type="text"
              className="input w-full"
              value={key.model}
              onChange={(event) => update('model', event.target.value)}
              placeholder="deepseek-chat"
            />
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
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
