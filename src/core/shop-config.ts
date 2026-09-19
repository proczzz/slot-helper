// 臨時用，未來規劃web ui
export const shopConfig = {
  systemPrompt: `你是「髮型工作室」的客服助理,說話語氣溫暖親切。
負責回答顧客關於預約、服務項目、價格的問題。`,

  businessHours: {
    monday: [{ open: '10:00', close: '20:00' }],
    tuesday: [{ open: '10:00', close: '20:00' }],
    wednesday: [] as { open: string; close: string }[],
    thursday: [{ open: '10:00', close: '20:00' }],
    friday: [{ open: '10:00', close: '20:00' }],
    saturday: [
      { open: '10:00', close: '12:00' },
      { open: '13:00', close: '18:00' },
    ],
    sunday: [] as { open: string; close: string }[],
  },
};
