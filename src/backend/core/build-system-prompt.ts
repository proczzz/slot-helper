import type { BusinessHours, DayKey, Service, ShopConfig } from '../model/shop-config.ts';
import { toLocalTime, toLocalWeekday } from './time.ts';

const DAY_LABELS: Record<DayKey, string> = {
  mon: '週一',
  tue: '週二',
  wed: '週三',
  thu: '週四',
  fri: '週五',
  sat: '週六',
  sun: '週日',
};

const DAY_KEYS = Object.keys(DAY_LABELS) as DayKey[];

const DAY_MINUTES = 24 * 60;

export function buildSystemPrompt(config: ShopConfig, customerName?: string | null): string {
  const nowAbsolute = new Date().toISOString();
  const now = toLocalTime(nowAbsolute, config.timeZone);
  const weekday = DAY_LABELS[toLocalWeekday(nowAbsolute, config.timeZone)];

  const systemPrompt = `${config.instructions}

${formatServices(config.services)}

${formatBusinessHours(config.businessHours)}

${customerName ? '目前對話的顧客: ' + customerName : ''}
目前時間: ${now} (${weekday})`;

  console.debug(systemPrompt);
  return systemPrompt;
}

function formatServices(services: Service[]): string {
  if (services.length === 0) return '';

  const lines = services.map(
    (service) => `${service.name} ${service.minutes} 分鐘 ${service.note}`,
  );
  return `服務項目\n${lines.join('\n')}`;
}

function formatBusinessHours(hours: BusinessHours): string {
  const lines = DAY_KEYS.filter((key) => hours[key].length > 0).map((key) => {
    const periods = hours[key].map(([start, end]) => `${start} 至 ${formatTime(end)}`);
    return `${DAY_LABELS[key]} ${periods.join('、')}`;
  });

  if (lines.length === 0) return '';
  return `營業時間\n${lines.join('\n')}`;
}

// 內部以超過 24:00 表示跨日，顯示給 AI 時換成「次日 HH:mm」
function formatTime(time: string): string {
  const [hour, minute] = time.split(':');
  const total = Number(hour) * 60 + Number(minute);
  if (total < DAY_MINUTES) return time;

  const nextDay = total - DAY_MINUTES;
  return `次日 ${String(Math.floor(nextDay / 60)).padStart(2, '0')}:${String(nextDay % 60).padStart(2, '0')}`;
}
