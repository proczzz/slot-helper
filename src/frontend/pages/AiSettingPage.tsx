import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AiKeyModal,
  EMPTY_KEY,
  USAGES,
  type AiKeyDraft,
} from '../components/AiKeyModal.tsx';
import { ModelMark, ProviderMark } from '../components/BrandMark.tsx';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getAiDemotions,
  getSection,
  saveSection,
  type AiKeyRequest,
  type AiKeyVo,
} from '../lib/admin.ts';

// 編輯中的那一列。index 等於長度代表新增
interface Editing {
  index: number;
  value: AiKeyDraft;
}

export function AiSettingsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'ai'],
    queryFn: async (): Promise<AiKeyDraft[]> =>
      (await getSection<AiKeyVo[]>('ai'))?.map((key) => ({ ...key, apiKey: undefined })) ?? [],
  });

  // 讀不到只影響「已停用」的提示,不該擋住整頁
  const demotions = useQuery({ queryKey: ['ai-demotions'], queryFn: getAiDemotions });

  const save = useMutation({
    mutationFn: (next: AiKeyDraft[]) => saveSection('ai', toRequest(next)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['config', 'ai'] });
      setEditing(null);
      setRemoving(null);
    },
  });

  useAutoReset(save);

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

  const keys = data;

  function move(index: number, step: number) {
    const next = [...keys];
    const [moved] = next.splice(index, 1);
    next.splice(index + step, 0, moved!);
    save.mutate(next);
  }

  function submit(draft: AiKeyDraft) {
    const next = [...keys];
    next[editing!.index] = draft;
    save.mutate(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">AI 模型</h2>
          <p className="mt-1 text-sm text-base-content/60">
            顧客的訊息由最上面那組「使用中」回覆，它失效時會自動往下換。
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setEditing({ index: keys.length, value: EMPTY_KEY })}
        >
          ＋ API key
        </button>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-20">順序</th>
                <th>名稱</th>
                <th>供應商</th>
                <th>API key</th>
                <th>模型</th>
                <th>用途</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-base-content/50">
                    尚未新增任何 API key
                  </td>
                </tr>
              )}

              {keys.map((key, index) => {
                const demotion = demotions.data?.find((item) => item.name === key.name);
                const usage = USAGES.find((item) => item.value === key.usage);

                return (
                  <tr key={key.name} className="hover:bg-base-200/40">
                    <td>
                      <div className="join">
                        <button
                          type="button"
                          className="btn btn-xs join-item"
                          onClick={() => move(index, -1)}
                          disabled={index === 0 || save.isPending}
                          aria-label={`${key.name} 往上移`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs join-item"
                          onClick={() => move(index, 1)}
                          disabled={index === keys.length - 1 || save.isPending}
                          aria-label={`${key.name} 往下移`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>

                    <td className="font-medium whitespace-nowrap">
                      {key.name}
                      {demotion && (
                        <span className="badge badge-warning badge-sm ml-2" title={demotion.reason}>
                          已停用
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap" title={key.provider}>
                      <ProviderMark provider={key.provider} />
                    </td>

                    <td>
                      <code className="font-mono text-xs opacity-70">{key.apiKeyMask}</code>
                    </td>

                    <td className="whitespace-nowrap">
                      <ModelMark model={key.model} />
                    </td>

                    <td>
                      <span className={`badge badge-sm whitespace-nowrap ${usage?.badge ?? ''}`}>
                        {usage?.label ?? key.usage}
                      </span>
                    </td>

                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditing({ index, value: key })}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-error"
                          onClick={() => setRemoving(index)}
                        >
                          移除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <AiKeyModal
          value={editing.value}
          takenNames={keys.filter((_, i) => i !== editing.index).map((key) => key.name)}
          demotion={demotions.data?.find((item) => item.name === editing.value.name)}
          pending={save.isPending}
          error={save.isError ? save.error.message : undefined}
          onClose={() => setEditing(null)}
          onSubmit={submit}
        />
      )}

      {removing !== null && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="text-lg font-bold">移除 API key</h3>
            <p className="py-4">
              確定要移除「{keys[removing]!.name}」嗎？金鑰會一併刪除，無法復原。
            </p>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setRemoving(null)}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={() => save.mutate(keys.filter((_, i) => i !== removing))}
                disabled={save.isPending}
              >
                {save.isPending && <span className="loading loading-spinner loading-xs" />}
                移除
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setRemoving(null)} />
        </div>
      )}

      {save.isSuccess && (
        <div className="toast toast-end">
          <div className="alert alert-success">已儲存</div>
        </div>
      )}

      {save.isError && !editing && (
        <div className="toast toast-end">
          <div className="alert alert-error">{save.error.message}</div>
        </div>
      )}
    </div>
  );
}

// 只送有改過的 apiKey,後端靠「欄位不存在」判斷沿用舊的
function toRequest(keys: AiKeyDraft[]): AiKeyRequest[] {
  return keys.map(({ apiKeyMask: _mask, apiKey, ...rest }) =>
    apiKey === undefined ? rest : { ...rest, apiKey },
  );
}
