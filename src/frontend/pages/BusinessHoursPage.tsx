import { useEffect, useState } from 'react';
import { getConfig, saveConfig } from '../lib/admin.ts';

const DAYS = [
  { key: 'mon', label: '週一' },
  { key: 'tue', label: '週二' },
  { key: 'wed', label: '週三' },
  { key: 'thu', label: '週四' },
  { key: 'fri', label: '週五' },
  { key: 'sat', label: '週六' },
  { key: 'sun', label: '週日' },
];

const DAY_MINUTES = 24 * 60;

type Period = [string, string];
type Hours = Record<string, Period[]>;
type DayErrors = { periods: Record<number, string>; overlap?: string };

const EMPTY: Hours = Object.fromEntries(DAYS.map((day) => [day.key, []]));

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function toHHmm(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const isOvernight = (period: Period) => toMinutes(period[1]) >= DAY_MINUTES;

// 輸入框只認得 00:00-23:59,跨日的結束時間要先減掉一天才能顯示
const toInputValue = (time: string) =>
  toMinutes(time) >= DAY_MINUTES ? toHHmm(toMinutes(time) - DAY_MINUTES) : time;

// 結束不晚於開始就視為跨日,存成超過 24:00 的形式
function normalizeEnd(start: string, end: string): string {
  return toMinutes(end) <= toMinutes(start) ? toHHmm(toMinutes(end) + DAY_MINUTES) : end;
}

function validateDay(periods: Period[]): DayErrors {
  const result: DayErrors = { periods: {} };

  periods.forEach((period, index) => {
    if (isOvernight(period) && index !== periods.length - 1) {
      result.periods[index] = '跨日時段要排在最後';
    }
  });

  const sorted = [...periods].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i]![0]) < toMinutes(sorted[i - 1]![1])) {
      result.overlap = '這一天的時段互相重疊';
      break;
    }
  }

  return result;
}

function sortAll(hours: Hours): Hours {
  return Object.fromEntries(
    Object.entries(hours).map(([key, periods]) => [
      key,
      [...periods].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0])),
    ]),
  );
}

export function BusinessHoursPage() {
  const [hours, setHours] = useState<Hours>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getConfig().then((config) => {
      const raw = config.BUSINESS_HOURS;
      try {
        setHours(raw ? { ...EMPTY, ...(JSON.parse(raw) as Hours) } : EMPTY);
      } catch {
        setHours(EMPTY);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  function update(dayKey: string, periods: Period[]) {
    setHours({ ...hours, [dayKey]: periods });
  }

  function addPeriod(dayKey: string) {
    const existing = hours[dayKey]!;
    const start = existing.length ? toInputValue(existing[existing.length - 1]![1]) : '10:00';
    const oneHourLater = toHHmm((toMinutes(start) + 60) % DAY_MINUTES);
    update(dayKey, [...existing, [start, normalizeEnd(start, oneHourLater)]]);
  }

  // start 與 end 都是輸入框上看到的值,跨日的判斷統一在這裡做
  function changePeriod(dayKey: string, index: number, start: string, end: string) {
    update(
      dayKey,
      hours[dayKey]!.map((period, i) => (i === index ? [start, normalizeEnd(start, end)] : period)),
    );
  }

  function removePeriod(dayKey: string, index: number) {
    update(
      dayKey,
      hours[dayKey]!.filter((_, i) => i !== index),
    );
  }

  async function submit() {
    const sorted = sortAll(hours);
    setHours(sorted);
    setSaving(true);
    const ok = await saveConfig({ BUSINESS_HOURS: JSON.stringify(sorted) });
    setSaving(false);
    setMessage(ok ? '已儲存' : '儲存失敗,請再試一次');
  }

  if (loading) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const errors = Object.fromEntries(
    DAYS.map(({ key }) => [key, validateDay(hours[key]!)] as const),
  );
  const hasError = DAYS.some(
    ({ key }) => errors[key]!.overlap || Object.keys(errors[key]!.periods).length > 0,
  );

  return (
    <div className="card max-w-3xl bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title">營業時間</h2>
        <p className="text-sm text-base-content/60">
          沒有時段的日子視為公休。結束時間早於開始時間會自動視為次日。
        </p>

        <div className="flex flex-col divide-y divide-base-200">
          {DAYS.map(({ key, label }) => {
            const periods = hours[key]!;
            const dayErrors = errors[key]!;

            return (
              <div key={key} className="flex gap-3 py-3">
                <div className="w-14 shrink-0 pt-2 font-medium">{label}</div>

                <div className="flex flex-1 flex-col gap-2">
                  {periods.length === 0 && (
                    <span className="pt-2 text-sm text-base-content/50">公休</span>
                  )}

                  {periods.map((period, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        className="input input-sm w-28"
                        value={period[0]}
                        onChange={(event) =>
                          changePeriod(key, index, event.target.value, toInputValue(period[1]))
                        }
                      />
                      <span className="text-base-content/50">至</span>
                      <input
                        type="time"
                        className="input input-sm w-28"
                        value={toInputValue(period[1])}
                        onChange={(event) =>
                          changePeriod(key, index, period[0], event.target.value)
                        }
                      />

                      {isOvernight(period) && <span className="badge badge-sm">次日</span>}

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => removePeriod(key, index)}
                        aria-label={`移除${label}的第 ${index + 1} 個時段`}
                      >
                        ✕
                      </button>

                      {dayErrors.periods[index] && (
                        <span className="text-sm text-error">{dayErrors.periods[index]}</span>
                      )}
                    </div>
                  ))}

                  {dayErrors.overlap && (
                    <span className="text-sm text-error">{dayErrors.overlap}</span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  onClick={() => addPeriod(key)}
                >
                  ＋ 時段
                </button>
              </div>
            );
          })}
        </div>

        <button
          className="btn btn-primary"
          disabled={saving || hasError}
          onClick={() => void submit()}
        >
          {saving && <span className="loading loading-spinner" />}
          儲存
        </button>
      </div>
    </div>
  );
}
