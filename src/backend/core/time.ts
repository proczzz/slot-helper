// 把絕對時間(帶偏移或 Z 的 ISO 字串)轉成指定時區的局部時間 YYYY-MM-DDTHH:mm。
// 和 AI 送進來的格式一致,它因此完全不需要知道時區存在
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

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// en-US 的 weekday short 剛好就是 Sun、Mon…,小寫後與 Weekday / DayKey 相同
export function toLocalWeekday(absolute: string, timeZone: string): Weekday {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
    .format(new Date(absolute))
    .toLowerCase() as Weekday;
}
