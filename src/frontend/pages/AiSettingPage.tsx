import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import { getSection, listModels, saveSection, type AiKey } from '../lib/admin.ts';

// 寫死的清單,要和後端 adapter/ai/index.ts 的 providers 表保持一致
const PROVIDERS = ['deepseek', 'anthropic', 'google', 'openai', 'nvidia', 'openrouter', 'groq'];

const EMPTY: AiKey = { name: '', provider: '', apiKey: '', model: '' };

export function AiSettingsPage() {
  // 設定是陣列,但目前只用第一組,多組備援之後再做
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'ai'],
    queryFn: async () => (await getSection<AiKey[]>('ai'))?.[0] ?? EMPTY,
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
      <div className="alert alert-error max-w-md">
        <span>{error.message}</span>
      </div>
    );
  }

  return <AiForm config={data} />;
}

function AiForm({ config }: { config: AiKey }) {
  const [key, setKey] = useState(config);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: AiKey) => saveSection('ai', [next]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'ai'] });
    },
  });

  // 要按按鈕才發生、而且得先填好 API key,所以是 mutation 不是 query
  const models = useMutation({
    mutationFn: (input: { provider: string; apiKey: string }) =>
      listModels(input.provider, input.apiKey),
  });

  useAutoReset(save);

  function update(field: keyof AiKey, value: string) {
    setKey({ ...key, [field]: value });
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
            save.mutate(key);
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
            <div className="join w-full">
              <input
                type="text"
                className="input join-item w-full"
                value={key.model}
                onChange={(event) => update('model', event.target.value)}
                placeholder="deepseek-chat"
                list="model-options"
              />
              <button
                type="button"
                className="btn join-item"
                onClick={() => models.mutate({ provider: key.provider, apiKey: key.apiKey })}
                disabled={models.isPending || !key.provider || !key.apiKey}
              >
                {models.isPending && <span className="loading loading-spinner loading-xs" />}
                載入
              </button>
            </div>

            <datalist id="model-options">
              {models.data?.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>

            {models.isError && <p className="label text-error">{models.error.message}</p>}

            {models.data && (
              <p className="label">共 {models.data.length} 個模型，點輸入框可以選擇</p>
            )}
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={save.isPending || !canSubmit}>
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
