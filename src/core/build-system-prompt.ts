import { shopConfig } from './shop-config.ts';

const DAY_NAMES: Record<string, string> = {
  monday: '週一',
  tuesday: '週二',
  wednesday: '週三',
  thursday: '週四',
  friday: '週五',
  saturday: '週六',
  sunday: '週日',
};

function formatBusinessHours(): string {
  return Object.entries(shopConfig.businessHours)
    .map(([day, slots]) => {
      const dayName = DAY_NAMES[day];
      if (slots.length === 0) {
        return `${dayName}:公休`;
      }
      const slotsText = slots.map((s) => `${s.open}-${s.close}`).join('、');
      return `${dayName}:${slotsText}`;
    })
    .join('\n');
}

export function buildSystemPrompt(): string {
  return `${shopConfig.systemPrompt}

營業時間:
${formatBusinessHours()}

目前時間:${new Date().toLocaleString('zh-TW', { timeZone: shopConfig.timezone })}`;
}
