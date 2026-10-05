import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAutoReset } from '../hooks/use-auto-reset.ts';
import {
  getCalendarLabels,
  getSection,
  saveSection,
  type DayKey,
  type EventLabel,
  type Period,
  type Service,
  type ShopConfig,
} from '../lib/admin.ts';
import {
  BROWSER_TIME_ZONE,
  TIME_ZONES,
  formatOffset,
  isValidTimeZone,
} from '../lib/time-zones.ts';
import {
  EMPTY_HOURS,
  isOvernight,
  nextPeriod,
  normalizeEnd,
  sortAll,
  toInputValue,
  validateDay,
  type DayErrors,
} from '../lib/business-hours.ts';

const DAYS = [
  { key: 'mon', label: '週一' },
  { key: 'tue', label: '週二' },
  { key: 'wed', label: '週三' },
  { key: 'thu', label: '週四' },
  { key: 'fri', label: '週五' },
  { key: 'sat', label: '週六' },
  { key: 'sun', label: '週日' },
] as const;

export function ShopSettingsPage() {
  const shop = useQuery({
    queryKey: ['config', 'shop'],
    queryFn: async () => {
      const config = await getSection<ShopConfig>('shop');
      return {
        instructions: config?.instructions ?? '',
        timeZone: config?.timeZone ?? BROWSER_TIME_ZONE,
        businessHours: { ...EMPTY_HOURS, ...(config?.businessHours ?? {}) },
        services: config?.services ?? [],
      } satisfies ShopConfig;
    },
  });

  // 標籤是選用的,讀不到只影響服務項目的下拉選單,不該擋住整頁設定
  const labels = useQuery({
    queryKey: ['calendar-labels'],
    queryFn: getCalendarLabels,
  });

  if (shop.isPending) {
    return (
      <div className="grid place-items-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (shop.isError) {
    return (
      <div className="alert alert-error max-w-3xl">
        <span>{shop.error.message}</span>
      </div>
    );
  }

  return <ShopForm config={shop.data} labels={labels.data ?? []} labelsFailed={labels.isError} />;
}

function ShopForm({
  config,
  labels,
  labelsFailed,
}: {
  config: ShopConfig;
  labels: EventLabel[];
  labelsFailed: boolean;
}) {
  const [instructions, setInstructions] = useState(config.instructions);
  const [timeZone, setTimeZone] = useState(config.timeZone);
  const [hours, setHours] = useState(config.businessHours);
  const [services, setServices] = useState(config.services);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (next: ShopConfig) => saveSection('shop', next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'shop'] });
    },
  });

  useAutoReset(save);

  function update(dayKey: DayKey, periods: Period[]) {
    setHours({ ...hours, [dayKey]: periods });
  }

  function addPeriod(dayKey: DayKey) {
    update(dayKey, [...hours[dayKey], nextPeriod(hours[dayKey])]);
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
    setServices([...services, { name: '', minutes: 60, price: 0, labelId: '' }]);
  }

  function changeService(index: number, field: keyof Service, value: string) {
    const isNumber = field === 'minutes' || field === 'price';
    setServices(
      services.map((service, i) =>
        i === index ? { ...service, [field]: isNumber ? Number(value) : value } : service,
      ),
    );
  }

  function removeService(index: number) {
    setServices(services.filter((_, i) => i !== index));
  }

  function submit() {
    const sorted = sortAll(hours);
    setHours(sorted);
    save.mutate({ instructions, timeZone, businessHours: sorted, services });
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

          {labelsFailed && (
            <p className="label text-error">
              讀不到日曆標籤，「日曆標籤」只能選「不指定」。請檢查 Google 日曆設定。
            </p>
          )}

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

              <fieldset className="fieldset w-40">
                <legend className="fieldset-legend">日曆標籤</legend>
                <LabelPicker
                  labels={labels}
                  value={service.labelId}
                  onChange={(labelId) => changeService(index, 'labelId', labelId)}
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

          <fieldset className="fieldset">
            <legend className="fieldset-legend">時區</legend>
            <input
              type="text"
              className="input w-full max-w-xs"
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
              list="time-zone-options"
              spellCheck={false}
            />

            <datalist id="time-zone-options">
              {TIME_ZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>

            {isValidTimeZone(timeZone) ? (
              <p className="label">
                目前 {formatOffset(timeZone)}。下方的營業時間、顧客說的時間都以這個時區為準
              </p>
            ) : (
              <p className="label text-error">
                不是有效的時區名稱。點輸入框可以搜尋，例如輸入「Taipei」
              </p>
            )}

            {timeZone !== BROWSER_TIME_ZONE && (
              <div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setTimeZone(BROWSER_TIME_ZONE)}
                >
                  改用這台電腦的時區（{BROWSER_TIME_ZONE}）
                </button>
              </div>
            )}
          </fieldset>

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
        disabled={save.isPending || hasError || !isValidTimeZone(timeZone)}
        onClick={submit}
      >
        {save.isPending && <span className="loading loading-spinner" />}
        儲存
      </button>

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
  );
}

function LabelPicker({
  labels,
  value,
  onChange,
}: {
  labels: EventLabel[];
  value: string;
  onChange: (labelId: string) => void;
}) {
  const current = labels.find((label) => label.id === value);

  return (
    <div className="dropdown w-full">
      <div tabIndex={0} role="button" className="btn btn-block justify-start font-normal">
        {current ? <LabelOption label={current} /> : '不指定'}
      </div>

      <ul
        tabIndex={0}
        className="dropdown-content menu z-10 max-h-64 w-52 flex-nowrap overflow-y-auto rounded-box bg-base-100 p-2 shadow"
      >
        <li>
          <button type="button" onClick={() => onChange('')}>
            不指定
          </button>
        </li>
        {labels.map((label) => (
          <li key={label.id}>
            <button type="button" onClick={() => onChange(label.id)}>
              <LabelOption label={label} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LabelOption({ label }: { label: EventLabel }) {
  return (
    <>
      <span
        className="inline-block size-3 shrink-0 rounded-full"
        style={{ backgroundColor: label.color }}
      />
      <span className="truncate">{label.name}</span>
    </>
  );
}
