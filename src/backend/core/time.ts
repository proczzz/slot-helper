// 帶時區的絕對時間 轉 局部(口語)時間
export function toLocalTime(absolute: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      // 不用 hour12: false,它在部分引擎會把午夜印成 24
      hourCycle: 'h23',
    })
      .formatToParts(new Date(absolute))
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// 局部(口語)時間 轉 帶時區的絕對時間
export function toAbsoluteTime(local: string, timeZone: string): string {
  const base = Date.parse(`${local}:00Z`);
  let absolute = base - offsetAt(base, timeZone);

  // 日光節約換季的那一小時,一次反解會落在錯的那一邊,用修正後的瞬間再算一次
  if (toLocalTime(new Date(absolute).toISOString(), timeZone) !== local) {
    absolute = base - offsetAt(absolute, timeZone);
  }

  return new Date(absolute).toISOString();
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// en-US 的 weekday short 剛好就是 Sun、Mon…,小寫後與 Weekday / DayKey 相同
export function toLocalWeekday(absolute: string, timeZone: string): Weekday {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
    .format(new Date(absolute))
    .toLowerCase() as Weekday;
}

// 驗證時區格式是否正確
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// 某個瞬間在指定時區的 UTC 偏移,毫秒
function offsetAt(instant: number, timeZone: string): number {
  const shown = toLocalTime(new Date(instant).toISOString(), timeZone);
  return Date.parse(`${shown}:00Z`) - instant;
}
