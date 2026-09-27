import type { BusinessHours, ShopSettings } from './model/shop-settings.ts';
import { shopConfig } from './shop-config.ts';

const DAYS: [string, string][] = [
  ['mon', '週一'],
  ['tue', '週二'],
  ['wed', '週三'],
  ['thu', '週四'],
  ['fri', '週五'],
  ['sat', '週六'],
  ['sun', '週日'],
];

const DAY_MINUTES = 24 * 60; // 一天有 1440 分鐘

export function buildSystemPrompt(settings: ShopSettings): string {
  const now = new Date().toLocaleString('zh-TW', { timeZone: shopConfig.timezone });

  return `${settings.instructions}

營業時間
${formatBusinessHours(settings.businessHours)}

目前時間:${now}`;
}

function formatBusinessHours(hours: BusinessHours): string {
  return DAYS.map(([key, label]) => {
    const periods = hours[key] ?? [];
    if (periods.length === 0) return `${label} 公休`;

    return `${label} ${periods.map(([start, end]) => `${start} 至 ${formatTime(end)}`).join('、')}`;
  }).join('\n');
}

// 內部以超過 24:00 表示跨日,顯示給 AI 時換成「次日 HH:mm」
function formatTime(time: string): string {
  const [hour, minute] = time.split(':');
  const total = Number(hour) * 60 + Number(minute);
  if (total < DAY_MINUTES) return time;
  const nextDay = total - DAY_MINUTES;
  return `次日 ${String(Math.floor(nextDay / 60)).padStart(2, '0')}:${String(nextDay % 60).padStart(2, '0')}`;
}
