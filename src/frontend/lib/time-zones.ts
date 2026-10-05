// Intl 內建的 IANA 時區清單,隨瀏覽器更新,不用自己維護。四百多筆,算一次就好
export const TIME_ZONES = Intl.supportedValuesOf('timeZone');

// 這台電腦的時區。一個 session 內不會變,所以在模組層級算一次
export const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function isValidTimeZone(value: string): boolean {
  return TIME_ZONES.includes(value);
}

// 老闆看不懂 IANA 名稱但看得懂 +8,顯示在旁邊讓他自己檢查有沒有選錯。
// 有日光節約的地區這個值會隨季節變,所以顯示時要寫「目前」
export function formatOffset(timeZone: string): string {
  if (!isValidTimeZone(timeZone)) return '';

  const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value;

  return offset?.replace('GMT', 'UTC') ?? '';
}
