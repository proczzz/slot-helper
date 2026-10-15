import type { TimePeriod } from '../adapter/scheduling/types.ts';
import type { BusinessHours, DayKey } from '../model/shop-config.ts';
import { toAbsoluteTime, toLocalTime } from './time.ts';

const DAY_MINUTES = 24 * 60;

export interface FreeSlotsOptions {
  range: TimePeriod; // 查詢範圍(絕對時間)
  busy: TimePeriod[]; // 已被佔用的時段(絕對時間),順序與重疊不拘
  businessHours: BusinessHours;
  timeZone: string;
  minutes?: number; // 服務時長,給了就丟掉放不下的區間
}

// 算出可以預約的區間:營業時間扣掉已佔用的時段,再截掉過去與查詢範圍外的部分。
// 回傳絕對時間,由呼叫端決定要不要轉成局部時間
export function freeSlots({
  range,
  busy,
  businessHours,
  timeZone,
  minutes = 0,
}: FreeSlotsOptions): TimePeriod[] {
  const within: Span = {
    start: Math.max(Date.parse(range.start), Date.now()), // 已經過去的時段不能預約
    end: Date.parse(range.end),
  };
  if (within.start >= within.end) return [];

  const open = clip(merge(openSpans(businessHours, timeZone, within)), within);
  const taken = merge(busy.map(toSpan));

  return subtract(open, taken)
    .filter((span) => span.end - span.start >= minutes * 60_000)
    .map((span) => ({
      start: new Date(span.start).toISOString(),
      end: new Date(span.end).toISOString(),
    }));
}

// 以毫秒表示的區間。內部一律用它運算,只在進出時轉換
interface Span {
  start: number;
  end: number;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// 把營業時間展開成絕對時間區間
function openSpans(businessHours: BusinessHours, timeZone: string, within: Span): Span[] {
  const spans: Span[] = [];

  // 前一天的跨日時段(週五 20:00-26:00)會延伸到今天凌晨,所以要從前一天開始走
  let date = addDays(localDateOf(within.start, timeZone), -1);
  const lastDate = localDateOf(within.end, timeZone);

  while (date <= lastDate) {
    for (const [from, to] of businessHours[weekdayOf(date)]) {
      const endMinutes = toMinutes(to);
      // 超過 24:00 代表跨日,結束時間落在隔天
      const endDate = addDays(date, Math.floor(endMinutes / DAY_MINUTES));
      const endTime = toHHmm(endMinutes % DAY_MINUTES);

      spans.push({
        start: Date.parse(toAbsoluteTime(`${date}T${from}`, timeZone)),
        end: Date.parse(toAbsoluteTime(`${endDate}T${endTime}`, timeZone)),
      });
    }

    date = addDays(date, 1);
  }

  return spans;
}

// 排序後合併相鄰或重疊的區間。老闆設定重疊的營業時段也會在這裡被吸收掉
function merge(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Span[] = [];

  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
}

function clip(spans: Span[], within: Span): Span[] {
  return spans
    .map((span) => ({
      start: Math.max(span.start, within.start),
      end: Math.min(span.end, within.end),
    }))
    .filter((span) => span.start < span.end);
}

function subtract(spans: Span[], blocks: Span[]): Span[] {
  return spans.flatMap((span) =>
    blocks.reduce<Span[]>((parts, block) => parts.flatMap((part) => cut(part, block)), [span]),
  );
}

// 從一個區間裡挖掉另一個,可能剩下 0、1 或 2 段
function cut(span: Span, block: Span): Span[] {
  if (block.end <= span.start || block.start >= span.end) return [span];

  const parts: Span[] = [];
  if (block.start > span.start) parts.push({ start: span.start, end: block.start });
  if (block.end < span.end) parts.push({ start: block.end, end: span.end });

  return parts;
}

function toSpan(period: TimePeriod): Span {
  return { start: Date.parse(period.start), end: Date.parse(period.end) };
}

function localDateOf(instant: number, timeZone: string): string {
  return toLocalTime(new Date(instant).toISOString(), timeZone).slice(0, 10);
}

// 純日期運算,和時區無關,所以用 UTC 算
function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function weekdayOf(date: string): DayKey {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function toHHmm(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
