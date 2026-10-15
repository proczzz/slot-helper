import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { listModels, restoreAiKey, type AiDemotion, type AiKeyVo, type AiUsage } from '../lib/admin.ts';
import { ModelMark, ProviderMark } from './BrandMark.tsx';
import { SecretField } from './SecretField.tsx';

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

export const USAGES: { value: AiUsage; label: string; badge: string }[] = [
  { value: 'active', label: '使用中', badge: 'badge-success' },
  { value: 'test', label: '僅後台測試', badge: 'badge-info' },
  { value: 'idle', label: '保留不使用', badge: 'badge-ghost' },
];

// apiKey 的 undefined 代表「沒在編輯」,送出時就不會放進 payload
export interface AiKeyDraft extends AiKeyVo {
  apiKey: string | undefined;
}

export const EMPTY_KEY: AiKeyDraft = {
  name: '',
  provider: '',
  model: '',
  usage: 'active',
  apiKeyMask: '',
  apiKey: '',
};

interface AiKeyModalProps {
  value: AiKeyDraft;
  takenNames: string[]; // 不含自己
  demotion: AiDemotion | undefined;
  pending: boolean;
  error: string | undefined;
  onClose: () => void;
  onSubmit: (next: AiKeyDraft) => void;
}

export function AiKeyModal({
  value,
  takenNames,
  demotion,
  pending,
  error,
  onClose,
  onSubmit,
}: AiKeyModalProps) {
  const [draft, setDraft] = useState(value);
  const queryClient = useQueryClient();

  const restore = useMutation({
    mutationFn: () => restoreAiKey(draft.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-demotions'] }),
  });

  // 要按按鈕才發生、而且得先有 key,所以是 mutation 不是 query
  const models = useMutation({
    mutationFn: () =>
      listModels(
        draft.apiKey
          ? { provider: draft.provider, apiKey: draft.apiKey }
          : { provider: draft.provider, name: draft.name },
      ),
  });

  const duplicated = takenNames.includes(draft.name);
  const hasKey = !!draft.apiKey || !!draft.apiKeyMask;
  const incomplete = !draft.name || !draft.provider || !draft.model || !hasKey;

  function update(field: 'name' | 'provider' | 'model' | 'usage', next: string) {
    setDraft({ ...draft, [field]: next });
  }

  // dropdown 靠 focus 開合,所以選完要主動移除焦點才會收起來
  function pick(provider: string) {
    update('provider', provider);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-xl">
        <h3 className="text-lg font-bold">{value.apiKeyMask ? '編輯 API key' : '新增 API key'}</h3>

        {demotion && (
          <div className="alert alert-warning mt-4 flex-col items-start gap-2 text-sm">
            <div>
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

        <form
          className="flex flex-col gap-3 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(draft);
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">名稱</legend>
            <input
              type="text"
              className={`input w-full ${duplicated ? 'input-error' : ''}`}
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="自己辨識用，例如「主力」"
              autoFocus
            />
            {duplicated && <p className="label text-error">名稱不可重複</p>}
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <fieldset className="fieldset flex-1">
              <legend className="fieldset-legend">供應商</legend>
              {/* <option> 放不了圖,所以用 dropdown 自己做 */}
              <div className="dropdown w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="btn btn-block relative justify-center px-3 font-normal"
                >
                  {draft.provider ? (
                    <ProviderMark provider={draft.provider} className="h-6 w-28" />
                  ) : (
                    <span className="opacity-50">請選擇</span>
                  )}
                  {/* 絕對定位,標記才能在按鈕正中間而不被箭頭推歪 */}
                  <svg
                    className="absolute right-3 size-4 opacity-50"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </div>

                <ul className="dropdown-content menu z-10 mt-1 max-h-72 w-full flex-nowrap overflow-y-auto rounded-box bg-base-100 p-2 shadow-lg">
                  {PROVIDERS.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        className="justify-center py-2"
                        onClick={() => pick(name)}
                      >
                        <ProviderMark provider={name} className="h-6 w-28" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </fieldset>

            <fieldset className="fieldset flex-1">
              <legend className="fieldset-legend">用途</legend>
              <select
                className="select w-full"
                value={draft.usage}
                onChange={(event) => update('usage', event.target.value)}
              >
                {USAGES.map((usage) => (
                  <option key={usage.value} value={usage.value}>
                    {usage.label}
                  </option>
                ))}
              </select>
            </fieldset>
          </div>

          <SecretField
            label="API key"
            mask={draft.apiKeyMask}
            value={draft.apiKey}
            onChange={(next) => setDraft({ ...draft, apiKey: next })}
          />

          <fieldset className="fieldset">
            <legend className="fieldset-legend">模型</legend>
            <div className="join w-full">
              <input
                type="text"
                className="input join-item w-full"
                value={draft.model}
                onChange={(event) => update('model', event.target.value)}
                placeholder="deepseek-chat"
                list="ai-model-options"
              />
              <button
                type="button"
                className="btn join-item"
                onClick={() => models.mutate()}
                disabled={models.isPending || !draft.provider || !hasKey}
              >
                {models.isPending && <span className="loading loading-spinner loading-xs" />}
                載入
              </button>
            </div>

            <datalist id="ai-model-options">
              {models.data?.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>

            {draft.model && (
              <div className="label">
                <ModelMark model={draft.model} />
              </div>
            )}

            {models.isError ? (
              <p className="label text-error">{models.error.message}</p>
            ) : models.data ? (
              <p className="label">共 {models.data.length} 個模型，點輸入框可以選擇</p>
            ) : (
              <p className="label">填好供應商與 key 後可以載入清單</p>
            )}
          </fieldset>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending || incomplete || duplicated}
            >
              {pending && <span className="loading loading-spinner loading-xs" />}
              儲存
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
