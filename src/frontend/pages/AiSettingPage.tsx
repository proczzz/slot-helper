import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getAiDemotions,
  getSection,
  listModels,
  restoreAiKey,
  saveSection,
  type AiDemotion,
  type AiKey,
  type AiUsage,
} from '../lib/admin.ts';

// 寫死的清單,要和後端 adapter/ai/index.ts 的 providers 表保持一致
const PROVIDERS = [
  'anthropic',
  'deepseek',
  'google',
  'groq',
  'nvidia',
  'openai',
  'openrouter',
  'xai',
];

const USAGES: { value: AiUsage; label: string }[] = [
  { value: 'active', label: '使用中' },
  { value: 'test', label: '僅後台測試' },
  { value: 'idle', label: '保留不使用' },
];

const EMPTY: AiKey = { name: '', provider: '', apiKey: '', model: '', usage: 'active' };

export function AiSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'ai'],
    // 舊資料沒有 usage,用 EMPTY 補齊才不會讓下拉選單空白
    queryFn: async () =>
      (await getSection<AiKey[]>('ai'))?.map((key) => ({ ...EMPTY, ...key })) ?? [],
  });

  // 讀不到只影響「已停用」的提示,不該擋住整頁設定
  const demotions = useQuery({
    queryKey: ['ai-demotions'],
    queryFn: getAiDemotions,
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

  return <AiForm config={data} demotions={demotions.data ?? []} />;
}

function AiForm({ config, demotions }: { config: AiKey[]; demotions: AiDemotion[] }) {
  const [keys, setKeys] = useState(config);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: AiKey[]) => saveSection('ai', next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'ai'] });
    },
  });

  useAutoReset(save);

  function add() {
    setKeys([...keys, EMPTY]);
  }

  function change(index: number, next: AiKey) {
    setKeys(keys.map((key, i) => (i === index ? next : key)));
  }

  function remove(index: number) {
    setKeys(keys.filter((_, i) => i !== index));
  }

  const incomplete = keys.some((key) => !key.name || !key.provider || !key.apiKey || !key.model);
  const duplicated = new Set(keys.map((key) => key.name)).size !== keys.length;

  return (
    <div className="card max-w-3xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">AI 模型</h2>
        <p className="text-sm text-base-content/60">
          目前只有第一組「使用中」會真的回覆顧客，多組備援還沒做。
        </p>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(keys);
          }}
        >
          {keys.length === 0 && (
            <span className="text-sm text-base-content/50">尚未新增任何 AI 模型</span>
          )}

          {keys.map((key, index) => (
            <AiKeyRow
              key={index}
              index={index}
              value={key}
              demotion={demotions.find((item) => item.name === key.name)}
              onChange={(next) => change(index, next)}
              onRemove={() => remove(index)}
            />
          ))}

          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={add}>
              ＋ 新增模型
            </button>
          </div>

          {duplicated && <p className="label text-error">名稱不可重複</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending || incomplete || duplicated}
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

function AiKeyRow({
  index,
  value,
  demotion,
  onChange,
  onRemove,
}: {
  index: number;
  value: AiKey;
  demotion: AiDemotion | undefined;
  onChange: (next: AiKey) => void;
  onRemove: () => void;
}) {
  const queryClient = useQueryClient();

  const restore = useMutation({
    mutationFn: () => restoreAiKey(value.name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-demotions'] });
    },
  });

  // 要按按鈕才發生、而且得先填好 API key,所以是 mutation 不是 query。
  // 每一列各自一份,否則載入的清單會跑到別人的輸入框
  const models = useMutation({
    mutationFn: (input: { provider: string; apiKey: string }) =>
      listModels(input.provider, input.apiKey),
  });

  const optionsId = `model-options-${index}`;

  function update(field: keyof AiKey, next: string) {
    onChange({ ...value, [field]: next });
  }

  return (
    <div className="rounded-box border border-base-300 p-3">
      {demotion && (
        <div className="alert alert-warning mb-2 flex-col items-start gap-2 text-sm sm:flex-row sm:items-center">
          <div className="flex-1">
            <p>這組金鑰失效後已自動停用，處理完再解除。</p>
            <p className="mt-1 font-mono text-xs opacity-70">{demotion.reason}</p>
            <p className="mt-1 text-xs opacity-60">
              停用於 {new Date(demotion.at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => restore.mutate()}
            disabled={restore.isPending}
          >
            {restore.isPending && <span className="loading loading-spinner loading-xs" />}
            解除停用
          </button>
        </div>
      )}

      {restore.isError && <p className="label text-error">{restore.error.message}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <fieldset className="fieldset flex-1">
          <legend className="fieldset-legend">名稱</legend>
          <input
            type="text"
            className="input w-full"
            value={value.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="自己辨識用，例如「主力」"
          />
        </fieldset>

        <fieldset className="fieldset w-36">
          <legend className="fieldset-legend">用途</legend>
          <select
            className="select w-full"
            value={value.usage}
            onChange={(event) => update('usage', event.target.value)}
          >
            {USAGES.map((usage) => (
              <option key={usage.value} value={usage.value}>
                {usage.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="fieldset w-40">
          <legend className="fieldset-legend">供應商</legend>
          <select
            className="select w-full"
            value={value.provider}
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

        <button
          type="button"
          className="btn btn-ghost btn-square mb-1"
          onClick={onRemove}
          aria-label={`移除第 ${index + 1} 組模型`}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <fieldset className="fieldset flex-1">
          <legend className="fieldset-legend">API key</legend>
          <input
            type="password"
            className="input w-full"
            value={value.apiKey}
            onChange={(event) => update('apiKey', event.target.value)}
          />
        </fieldset>

        <fieldset className="fieldset flex-1">
          <legend className="fieldset-legend">模型</legend>
          <div className="join w-full">
            <input
              type="text"
              className="input join-item w-full"
              value={value.model}
              onChange={(event) => update('model', event.target.value)}
              placeholder="deepseek-chat"
              list={optionsId}
            />
            <button
              type="button"
              className="btn join-item"
              onClick={() => models.mutate({ provider: value.provider, apiKey: value.apiKey })}
              disabled={models.isPending || !value.provider || !value.apiKey}
            >
              {models.isPending && <span className="loading loading-spinner loading-xs" />}
              載入
            </button>
          </div>

          <datalist id={optionsId}>
            {models.data?.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>

          {models.isError && <p className="label text-error">{models.error.message}</p>}

          {models.data && <p className="label">共 {models.data.length} 個模型，點輸入框可以選擇</p>}
        </fieldset>
      </div>
    </div>
  );
}
