import { useEffect, useState } from 'react';
import {
  getSection,
  saveSection,
  type BusinessHours,
  type DayKey,
  type Period,
  type Service,
  type ShopSettings,
} from '../lib/admin.ts';

const DAYS = [
  { key: 'mon', label: '週一' },
  { key: 'tue', label: '週二' },
  { key: 'wed', label: '週三' },
  { key: 'thu', label: '週四' },
  { key: 'fri', label: '週五' },
  { key: 'sat', label: '週六' },
  { key: 'sun', label: '週日' },
] as const;

const DAY_MINUTES = 24 * 60;

type DayErrors = { periods: Record<number, string>; overlap?: string };

const EMPTY_HOURS: BusinessHours = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function toHHmm(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const isOvernight = (period: Period) => toMinutes(period[1]) >= DAY_MINUTES;

// 輸入框只認得 00:00-23:59，跨日的結束時間要先減掉一天才能顯示
const toInputValue = (time: string) =>
  toMinutes(time) >= DAY_MINUTES ? toHHmm(toMinutes(time) - DAY_MINUTES) : time;

// 結束不晚於開始就視為跨日，存成超過 24:00 的形式
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

function sortAll(hours: BusinessHours): BusinessHours {
  const sorted = { ...hours };
  for (const { key } of DAYS) {
    sorted[key] = [...hours[key]].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  }
  return sorted;
}

export function ShopSettingsPage() {
  const [instructions, setInstructions] = useState('');
  const [hours, setHours] = useState<BusinessHours>(EMPTY_HOURS);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getSection<ShopSettings>('shop')
      .then((settings) => {
        setInstructions(settings?.instructions ?? '');
        setHours({ ...EMPTY_HOURS, ...(settings?.businessHours ?? {}) });
        setServices(settings?.services ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  function update(dayKey: DayKey, periods: Period[]) {
    setHours({ ...hours, [dayKey]: periods });
  }

  function addPeriod(dayKey: DayKey) {
    const existing = hours[dayKey];
    const start = existing.length ? toInputValue(existing[existing.length - 1]![1]) : '10:00';
    const oneHourLater = toHHmm((toMinutes(start) + 60) % DAY_MINUTES);
    update(dayKey, [...existing, [start, normalizeEnd(start, oneHourLater)]]);
  }

  // start 與 end 都是輸入框上看到的值，跨日的判斷統一在這裡做
  function changePeriod(dayKey: DayKey, index: number, start: string, end: string) {
    update(
      dayKey,
      hours[dayKey].map((period, i) => (i === index ? [start, normalizeEnd(start, end)] : period)),
    );
  }

  function removePeriod(dayKey: DayKey, index: number) {
    update(
      dayKey,
      hours[dayKey].filter((_, i) => i !== index),
    );
  }

  function addService() {
    setServices([...services, { name: '', minutes: 60, price: 0 }]);
  }

  function changeService(index: number, field: keyof Service, value: string) {
    setServices(
      services.map((service, i) =>
        i === index ? { ...service, [field]: field === 'name' ? value : Number(value) } : service,
      ),
    );
  }

  function removeService(index: number) {
    setServices(services.filter((_, i) => i !== index));
  }

  async function submit() {
    const sorted = sortAll(hours);
    setHours(sorted);
    setSaving(true);
    const error = await saveSection('shop', {
      instructions,
      businessHours: sorted,
      services,
    });
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

  const errors = Object.fromEntries(
    DAYS.map(({ key }) => [key, validateDay(hours[key])]),
  ) as Record<DayKey, DayErrors>;

  const hasError = DAYS.some(
    ({ key }) => errors[key].overlap || Object.keys(errors[key].periods).length > 0,
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title">AI 指示</h2>
          <p className="text-sm text-base-content/60">描述 AI 的身分、說話方式與服務規則。</p>

          <textarea
            className="textarea textarea-bordered w-full resize-none leading-relaxed"
            rows={16}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="例如：你是「小花美甲」的預約助理，語氣親切簡短⋯⋯"
            spellCheck={false}
          />

          <div className="rounded-box bg-base-200 p-4 text-sm">
            <p className="mb-2 font-medium">系統會自動附加以下內容，不需要自己寫</p>
            <ul className="list-inside list-disc text-base-content/70">
              <li>服務項目與營業時間（下方設定）</li>
              <li>目前時間（台北時區）</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title">服務項目</h2>
          <p className="text-sm text-base-content/60">
            AI 會依照所需時間判斷要預留多久，也會用這些價格回答顧客。
          </p>

          {services.length === 0 && (
            <span className="text-sm text-base-content/50">尚未新增任何服務</span>
          )}

          {services.map((service, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <fieldset className="fieldset flex-1">
                <legend className="fieldset-legend">名稱</legend>
                <input
                  type="text"
                  className="input w-full"
                  value={service.name}
                  onChange={(event) => changeService(index, 'name', event.target.value)}
                  placeholder="染髮"
                />
              </fieldset>

              <fieldset className="fieldset w-28">
                <legend className="fieldset-legend">分鐘</legend>
                <input
                  type="number"
                  className="input w-full"
                  value={service.minutes}
                  onChange={(event) => changeService(index, 'minutes', event.target.value)}
                  min={1}
                />
              </fieldset>

              <fieldset className="fieldset w-28">
                <legend className="fieldset-legend">價格</legend>
                <input
                  type="number"
                  className="input w-full"
                  value={service.price}
                  onChange={(event) => changeService(index, 'price', event.target.value)}
                  min={0}
                />
              </fieldset>

              <button
                type="button"
                className="btn btn-ghost btn-square mb-1"
                onClick={() => removeService(index)}
                aria-label={`移除第 ${index + 1} 個服務`}
              >
                ✕
              </button>
            </div>
          ))}

          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addService}>
              ＋ 新增服務
            </button>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title">營業時間</h2>
          <p className="text-sm text-base-content/60">
            沒有時段的日子視為公休。結束時間早於開始時間會自動視為次日。
          </p>

          <div className="flex flex-col divide-y divide-base-200">
            {DAYS.map(({ key, label }) => {
              const periods = hours[key];
              const dayErrors = errors[key];

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
        </div>
      </div>

      <button
        className="btn btn-primary"
        disabled={saving || hasError}
        onClick={() => void submit()}
      >
        {saving && <span className="loading loading-spinner" />}
        儲存
      </button>

      {message && (
        <div className="toast toast-end">
          <div className="alert">{message}</div>
        </div>
      )}
    </div>
  );
}
