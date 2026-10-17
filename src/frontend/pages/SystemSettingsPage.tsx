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
// 啟用時不接受 0 —— 0 是「不使用記憶」,由開關表達
const HISTORY_RANGE = { min: 1, max: 50 };
const DAYS_RANGE = { min: 1, max: 365 };
const STEPS_RANGE = { min: 1, max: 20 };
// 啟用時不接受 0 —— 0 是「關閉」的意思,由開關表達,不讓使用者自己打
const PAUSE_RANGE = { min: 1, max: 1440 };

// 關閉時 track 很淡,開啟時整條變綠
const TOGGLE =
  'toggle border-base-300 bg-base-200 text-base-content/40 checked:border-success checked:bg-success checked:text-success-content';

const DEFAULT_PAUSE_MINUTES = '10';
const DEFAULT_HISTORY_TURNS = '15';
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
      <div className="alert alert-error mx-auto w-full max-w-3xl">
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
  // 後端用「暫停 0 分鐘」表示關閉,畫面上給一個開關就好
  const [limitEnabled, setLimitEnabled] = useState(config.limitPauseMinutes > 0);
  // 後端用「記 0 輪」表示不使用記憶,畫面上給一個開關就好
  const [memoryEnabled, setMemoryEnabled] = useState(config.historyTurns > 0);
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
  // 關閉時這兩格送不出去,不用擋
  const historyInvalid =
    memoryEnabled &&
    (!Number.isInteger(turns) || turns < HISTORY_RANGE.min || turns > HISTORY_RANGE.max);
  const daysInvalid =
    memoryEnabled && (!Number.isInteger(days) || days < DAYS_RANGE.min || days > DAYS_RANGE.max);

  function toggleMemory(enabled: boolean) {
    setMemoryEnabled(enabled);
    if (enabled && !(turns >= HISTORY_RANGE.min)) setHistoryTurns(DEFAULT_HISTORY_TURNS);
  }
  const stepsInvalid =
    !Number.isInteger(steps) || steps < STEPS_RANGE.min || steps > STEPS_RANGE.max;
  const replyInvalid = fallbackReply.trim().length === 0;

  const pauseMinutes = Number(limitPauseMinutes);
  const limitCount = Number(limitTurns);
  const windowMinutes = Number(limitWindowMinutes);
  // 關閉時這三格送不出去,不用擋
  const pauseInvalid =
    limitEnabled &&
    (!Number.isInteger(pauseMinutes) ||
      pauseMinutes < PAUSE_RANGE.min ||
      pauseMinutes > PAUSE_RANGE.max);
  const limitTurnsInvalid =
    limitEnabled &&
    (!Number.isInteger(limitCount) ||
      limitCount < LIMIT_TURNS_RANGE.min ||
      limitCount > LIMIT_TURNS_RANGE.max);
  const windowInvalid =
    limitEnabled &&
    (!Number.isInteger(windowMinutes) ||
      windowMinutes < WINDOW_RANGE.min ||
      windowMinutes > WINDOW_RANGE.max);

  // 從關閉切到開啟時,0 不是合法值,補一個預設
  function toggleLimit(enabled: boolean) {
    setLimitEnabled(enabled);
    if (enabled && !(pauseMinutes >= PAUSE_RANGE.min)) {
      setLimitPauseMinutes(DEFAULT_PAUSE_MINUTES);
    }
  }

  return (
    <div className="card mx-auto w-full max-w-3xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">系統設定</h2>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // 後端的 schema 收的是數字,不是字串
            save.mutate({
              historyTurns: memoryEnabled ? turns : 0,
              historyDays: days,
              maxSteps: steps,
              fallbackReply,
              limitPauseMinutes: limitEnabled ? pauseMinutes : 0,
              limitTurns: limitCount,
              limitWindowMinutes: windowMinutes,
              limitNotify,
            });
          }}
        >
          <fieldset className="fieldset">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className={TOGGLE}
                checked={memoryEnabled}
                onChange={(event) => toggleMemory(event.target.checked)}
              />
              <span className="text-base-content">啟用 AI 記憶</span>
            </label>
            <p className="mt-1 text-xs opacity-60">
              讓 AI 看的到之前的對話。費用會隨歷史對話發送量增加。超過天數的對話不會再給 AI
              看，但仍留在資料庫裡
            </p>
          </fieldset>

          <fieldset className="fieldset gap-3" disabled={!memoryEnabled}>
            <div className="flex flex-wrap items-start gap-3">
              <label className="flex grow basis-32 flex-col gap-1">
                <span className="fieldset-legend">輪數</span>
                <input
                  type="number"
                  className={`input w-full ${historyInvalid ? 'input-error' : ''}`}
                  value={historyTurns}
                  min={HISTORY_RANGE.min}
                  max={HISTORY_RANGE.max}
                  onChange={(event) => setHistoryTurns(event.target.value)}
                />
                <span className="label">顧客與 AI 各一則訊息為一輪</span>
              </label>

              <label className="flex grow basis-32 flex-col gap-1">
                <span className="fieldset-legend">天數</span>
                <input
                  type="number"
                  className={`input w-full ${daysInvalid ? 'input-error' : ''}`}
                  value={historyDays}
                  min={DAYS_RANGE.min}
                  max={DAYS_RANGE.max}
                  onChange={(event) => setHistoryDays(event.target.value)}
                />
              </label>
            </div>

            {historyInvalid && (
              <p className="label text-error">
                輪數請輸入 {HISTORY_RANGE.min} 到 {HISTORY_RANGE.max} 之間的整數
              </p>
            )}
            {daysInvalid && (
              <p className="label text-error">
                天數請輸入 {DAYS_RANGE.min} 到 {DAYS_RANGE.max} 之間的整數
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
            <p className="label">回應也算一次</p>
            {stepsInvalid && (
              <p className="label text-error">
                請輸入 {STEPS_RANGE.min} 到 {STEPS_RANGE.max} 之間的整數
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
            <p className="label">AI 沒能回覆時改傳這句</p>
            {replyInvalid && <p className="label text-error">請輸入保底訊息</p>}
          </fieldset>

          <div className="divider mb-0 text-sm opacity-60">對話頻率上限</div>

          <fieldset className="fieldset">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className={TOGGLE}
                checked={limitEnabled}
                onChange={(event) => toggleLimit(event.target.checked)}
              />
              <span className="text-base-content">啟用對話頻率上限</span>
            </label>
            <p className="mt-1 text-xs opacity-60">
              同一位顧客問太頻繁時暫停回應，由你自己接手。暫停期間 AI 完全不說話
            </p>
          </fieldset>

          <fieldset className="fieldset gap-3" disabled={!limitEnabled}>
            {/* 讀起來是一句話。輸入框平分剩下的寬度,窄螢幕才換行 */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                className={`input min-w-16 grow basis-16 ${windowInvalid ? 'input-error' : ''}`}
                value={limitWindowMinutes}
                min={WINDOW_RANGE.min}
                max={WINDOW_RANGE.max}
                onChange={(event) => setLimitWindowMinutes(event.target.value)}
              />
              <span className="shrink-0">分鐘內對話</span>
              <input
                type="number"
                className={`input min-w-16 grow basis-16 ${limitTurnsInvalid ? 'input-error' : ''}`}
                value={limitTurns}
                min={LIMIT_TURNS_RANGE.min}
                max={LIMIT_TURNS_RANGE.max}
                onChange={(event) => setLimitTurns(event.target.value)}
              />
              <span className="shrink-0">輪，則暫停</span>
              <input
                type="number"
                className={`input min-w-16 grow basis-16 ${pauseInvalid ? 'input-error' : ''}`}
                value={limitPauseMinutes}
                min={PAUSE_RANGE.min}
                max={PAUSE_RANGE.max}
                onChange={(event) => setLimitPauseMinutes(event.target.value)}
              />
              <span className="shrink-0">分鐘</span>
            </div>

            {windowInvalid && (
              <p className="label text-error">
                時間範圍請輸入 {WINDOW_RANGE.min} 到 {WINDOW_RANGE.max} 之間的整數
              </p>
            )}
            {limitTurnsInvalid && (
              <p className="label text-error">
                輪數請輸入 {LIMIT_TURNS_RANGE.min} 到 {LIMIT_TURNS_RANGE.max} 之間的整數
              </p>
            )}
            {pauseInvalid && (
              <p className="label text-error">
                暫停分鐘請輸入 {PAUSE_RANGE.min} 到 {PAUSE_RANGE.max} 之間的整數
              </p>
            )}

            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className={TOGGLE}
                checked={limitNotify}
                onChange={(event) => setLimitNotify(event.target.checked)}
              />
              <span className="text-base-content">有人被暫停時用 Telegram 通知我</span>
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
