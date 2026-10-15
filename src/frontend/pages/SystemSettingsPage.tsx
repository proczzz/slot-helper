import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import { getSection, saveSection, type SystemConfigVo } from '../lib/admin.ts';

// 和後端 core/system-config.ts 的預設值保持一致
const EMPTY: SystemConfigVo = {
  historyTurns: 15,
  historyDays: 30,
  maxSteps: 8,
  fallbackReply: '不好意思,系統暫時有點問題,請稍後再傳一次訊息,或直接打電話給店裡。',
  limitPauseMinutes: 0,
  limitTurns: 30,
  limitWindowMinutes: 10,
  limitNotify: true,
};

// 和後端的 schema 一致,超出範圍就不給存
const HISTORY_RANGE = { min: 0, max: 50 };
const DAYS_RANGE = { min: 1, max: 365 };
const STEPS_RANGE = { min: 1, max: 20 };
const PAUSE_RANGE = { min: 0, max: 1440 };
const LIMIT_TURNS_RANGE = { min: 1, max: 200 };
const WINDOW_RANGE = { min: 1, max: 1440 };

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
  const [historyDays, setHistoryDays] = useState(String(config.historyDays));
  const [maxSteps, setMaxSteps] = useState(String(config.maxSteps));
  const [fallbackReply, setFallbackReply] = useState(config.fallbackReply);
  const [limitPauseMinutes, setLimitPauseMinutes] = useState(String(config.limitPauseMinutes));
  const [limitTurns, setLimitTurns] = useState(String(config.limitTurns));
  const [limitWindowMinutes, setLimitWindowMinutes] = useState(String(config.limitWindowMinutes));
  const [limitNotify, setLimitNotify] = useState(config.limitNotify);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: SystemConfigVo) => saveSection('system', next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'system'] });
    },
  });

  useAutoReset(save);

  const turns = Number(historyTurns);
  const days = Number(historyDays);
  const steps = Number(maxSteps);
  const historyInvalid =
    !Number.isInteger(turns) || turns < HISTORY_RANGE.min || turns > HISTORY_RANGE.max;
  const daysInvalid = !Number.isInteger(days) || days < DAYS_RANGE.min || days > DAYS_RANGE.max;
  const stepsInvalid =
    !Number.isInteger(steps) || steps < STEPS_RANGE.min || steps > STEPS_RANGE.max;
  const replyInvalid = fallbackReply.trim().length === 0;

  const pauseMinutes = Number(limitPauseMinutes);
  const limitCount = Number(limitTurns);
  const windowMinutes = Number(limitWindowMinutes);
  const pauseInvalid =
    !Number.isInteger(pauseMinutes) ||
    pauseMinutes < PAUSE_RANGE.min ||
    pauseMinutes > PAUSE_RANGE.max;
  const limitTurnsInvalid =
    !Number.isInteger(limitCount) ||
    limitCount < LIMIT_TURNS_RANGE.min ||
    limitCount > LIMIT_TURNS_RANGE.max;
  const windowInvalid =
    !Number.isInteger(windowMinutes) ||
    windowMinutes < WINDOW_RANGE.min ||
    windowMinutes > WINDOW_RANGE.max;

  return (
    <div className="card max-w-2xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">系統設定</h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // 後端的 schema 收的是數字,不是字串
            save.mutate({
              historyTurns: turns,
              historyDays: days,
              maxSteps: steps,
              fallbackReply,
              limitPauseMinutes: pauseMinutes,
              limitTurns: limitCount,
              limitWindowMinutes: windowMinutes,
              limitNotify,
            });
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
                一輪是顧客與 AI 各一則訊息，設 0 代表不使用記憶。記得越久，每次回覆的費用越高
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">AI 記憶的保留天數</legend>
            <input
              type="number"
              className={`input w-full ${daysInvalid ? 'input-error' : ''}`}
              value={historyDays}
              min={DAYS_RANGE.min}
              max={DAYS_RANGE.max}
              onChange={(event) => setHistoryDays(event.target.value)}
            />
            {daysInvalid ? (
              <p className="label text-error">
                請輸入 {DAYS_RANGE.min} 到 {DAYS_RANGE.max} 之間的整數
              </p>
            ) : (
              <p className="mt-1 text-xs opacity-60">
                超過這個天數的對話不會再給 AI 看。顧客隔很久才回來時，AI 不會提起太舊的事
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

          <div className="divider mb-0 text-sm opacity-60">對話頻率上限</div>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">超過上限後暫停幾分鐘</legend>
            <input
              type="number"
              className={`input w-full ${pauseInvalid ? 'input-error' : ''}`}
              value={limitPauseMinutes}
              min={PAUSE_RANGE.min}
              max={PAUSE_RANGE.max}
              onChange={(event) => setLimitPauseMinutes(event.target.value)}
            />
            {pauseInvalid ? (
              <p className="label text-error">
                請輸入 {PAUSE_RANGE.min} 到 {PAUSE_RANGE.max} 之間的整數
              </p>
            ) : (
              <p className="mt-1 text-xs opacity-60">
                暫停期間 AI 不回應這位顧客，由你自己接手。設 0 代表關閉這個功能
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">幾輪算是太頻繁</legend>
            <input
              type="number"
              className={`input w-full ${limitTurnsInvalid ? 'input-error' : ''}`}
              value={limitTurns}
              min={LIMIT_TURNS_RANGE.min}
              max={LIMIT_TURNS_RANGE.max}
              onChange={(event) => setLimitTurns(event.target.value)}
            />
            {limitTurnsInvalid ? (
              <p className="label text-error">
                請輸入 {LIMIT_TURNS_RANGE.min} 到 {LIMIT_TURNS_RANGE.max} 之間的整數
              </p>
            ) : (
              <p className="mt-1 text-xs opacity-60">
                同一位顧客在下面那段時間內問超過這個輪數，就會被暫停
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">計算的時間範圍（分鐘）</legend>
            <input
              type="number"
              className={`input w-full ${windowInvalid ? 'input-error' : ''}`}
              value={limitWindowMinutes}
              min={WINDOW_RANGE.min}
              max={WINDOW_RANGE.max}
              onChange={(event) => setLimitWindowMinutes(event.target.value)}
            />
            {windowInvalid ? (
              <p className="label text-error">
                請輸入 {WINDOW_RANGE.min} 到 {WINDOW_RANGE.max} 之間的整數
              </p>
            ) : (
              <p className="mt-1 text-xs opacity-60">往回看這麼久的訊息來計算輪數</p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={limitNotify}
                onChange={(event) => setLimitNotify(event.target.checked)}
              />
              <span>暫停時用 Telegram 通知我</span>
            </label>
          </fieldset>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              save.isPending ||
              historyInvalid ||
              daysInvalid ||
              stepsInvalid ||
              replyInvalid ||
              pauseInvalid ||
              limitTurnsInvalid ||
              windowInvalid
            }
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
