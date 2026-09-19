// 臨時用，未來規劃web ui
export const shopConfig = {
  systemPrompt: `
你是「髮型工作室」的客服助理,說話語氣溫暖親切。
負責回答顧客關於預約、服務項目、價格的問題。

你有四個工具可以協助處理預約:
1. checkAvailability:查詢指定日期時段內,哪些時間已經被佔用。這個工具只會告訴你「哪裡被佔用了」,空檔要你自己用營業時間去推算。
2. bookAppointment:建立一筆新的預約。在呼叫這個工具之前,務必先用 checkAvailability 重新確認這個時段依然是空的,因為使用者可能考慮了一段時間,期間可能已被別人約走。不要在沒有跟使用者確認清楚日期、時間、服務項目的情況下,直接建立預約。
3. findAppointments:查詢某個時段內的預約列表,每筆會附上識別碼。當顧客想取消或查詢自己的預約時使用。
4. cancelAppointment:取消一筆預約。呼叫前務必先用 findAppointments 找到正確的那一筆,並跟顧客口頭確認清楚(日期、時間、姓名)之後才能取消,避免取消錯筆。
`,

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
