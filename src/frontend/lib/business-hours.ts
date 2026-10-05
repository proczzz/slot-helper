import type { BusinessHours, DayKey, Period } from './admin.ts';

export const EMPTY_HOURS: BusinessHours = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

export type DayErrors = { periods: Record<number, string>; overlap?: string };

export function isOvernight(period: Period): boolean {
  return toMinutes(period[1]) >= DAY_MINUTES;
}

// 輸入框只認得 00:00-23:59，跨日的結束時間要先減掉一天才能顯示
export function toInputValue(time: string): string {
  return toMinutes(time) >= DAY_MINUTES ? toHHmm(toMinutes(time) - DAY_MINUTES) : time;
}

// 結束不晚於開始就視為跨日，存成超過 24:00 的形式
export function normalizeEnd(start: string, end: string): string {
  return toMinutes(end) <= toMinutes(start) ? toHHmm(toMinutes(end) + DAY_MINUTES) : end;
}

// 新增時段的預設值：接在當天最後一段之後，長度一小時
export function nextPeriod(periods: Period[]): Period {
  const start = periods.length ? toInputValue(periods[periods.length - 1]![1]) : '10:00';
  const end = toHHmm((toMinutes(start) + 60) % DAY_MINUTES);
  return [start, normalizeEnd(start, end)];
}

// 規則只有兩條：跨日時段必須排在當天最後、同一天內不重疊
export function validateDay(periods: Period[]): DayErrors {
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

export function sortAll(hours: BusinessHours): BusinessHours {
  const sorted = { ...hours };
  for (const key of DAY_KEYS) {
    sorted[key] = [...hours[key]].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  }
  return sorted;
}

const DAY_MINUTES = 24 * 60;

// 只用來走訪全部七天，順序不影響結果
const DAY_KEYS = Object.keys(EMPTY_HOURS) as DayKey[];

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function toHHmm(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
