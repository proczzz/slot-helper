import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import { getSection, saveSection, type SystemConfigVo } from '../lib/admin.ts';

// 和後端 core/system-config.ts 的預設值保持一致
const EMPTY: SystemConfigVo = {
  historyTurns: 15,
  maxSteps: 8,
  fallbackReply: '不好意思,系統暫時有點問題,請稍後再傳一次訊息,或直接打電話給店裡。',
};

// 和後端的 schema 一致,超出範圍就不給存
const HISTORY_RANGE = { min: 1, max: 50 };
const STEPS_RANGE = { min: 1, max: 20 };

export function SystemSettingsPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['config', 'system'],
    queryFn: () => getSection<SystemConfigVo>('system'),
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

  return <SystemForm config={{ ...EMPTY, ...data }} />;
}

function SystemForm({ config }: { config: SystemConfigVo }) {
  // 輸入框的值用字串存,空白與「正在打字」才表示得出來
  const [historyTurns, setHistoryTurns] = useState(String(config.historyTurns));
  const [maxSteps, setMaxSteps] = useState(String(config.maxSteps));
  const [fallbackReply, setFallbackReply] = useState(config.fallbackReply);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: SystemConfigVo) => saveSection('system', next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'system'] });
    },
  });

  useAutoReset(save);

  const turns = Number(historyTurns);
  const steps = Number(maxSteps);
  const historyInvalid =
    !Number.isInteger(turns) || turns < HISTORY_RANGE.min || turns > HISTORY_RANGE.max;
  const stepsInvalid =
    !Number.isInteger(steps) || steps < STEPS_RANGE.min || steps > STEPS_RANGE.max;
  const replyInvalid = fallbackReply.trim().length === 0;

  return (
    <div className="card max-w-2xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">系統設定</h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // 後端的 schema 收的是數字,不是字串
            save.mutate({ historyTurns: turns, maxSteps: steps, fallbackReply });
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">AI 記憶的對話輪數</legend>
            <input
              type="number"
              className={`input w-full ${historyInvalid ? 'input-error' : ''}`}
              value={historyTurns}
              min={HISTORY_RANGE.min}
              max={HISTORY_RANGE.max}
              onChange={(event) => setHistoryTurns(event.target.value)}
            />
            {historyInvalid ? (
              <p className="label text-error">
                請輸入 {HISTORY_RANGE.min} 到 {HISTORY_RANGE.max} 之間的整數
              </p>
            ) : (
              <p className="mt-1 text-xs opacity-60">
                一輪是顧客與 AI 各一則訊息。記得越久，每次回覆的費用越高
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">工具操作次數上限</legend>
            <input
              type="number"
              className={`input w-full ${stepsInvalid ? 'input-error' : ''}`}
              value={maxSteps}
              min={STEPS_RANGE.min}
              max={STEPS_RANGE.max}
              onChange={(event) => setMaxSteps(event.target.value)}
            />
            {stepsInvalid ? (
              <p className="label text-error">
                請輸入 {STEPS_RANGE.min} 到 {STEPS_RANGE.max} 之間的整數
              </p>
            ) : (
              <p className="mt-1 text-xs opacity-60">
                回應也算一次操作。為避免 AI 掉進錯誤循環，超過設定就會中止這次處理
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">保底訊息</legend>
            <textarea
              className={`textarea h-24 w-full resize-none ${replyInvalid ? 'textarea-error' : ''}`}
              value={fallbackReply}
              onChange={(event) => setFallbackReply(event.target.value)}
            />
            {replyInvalid ? (
              <p className="label text-error">請輸入保底訊息</p>
            ) : (
              <p className="mt-1 text-xs opacity-60">
                工具操作次數用完、或 AI 沒能產生回覆時，改傳這句給顧客
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending || historyInvalid || stepsInvalid || replyInvalid}
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
