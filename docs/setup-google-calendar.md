# Google 日曆

> [!NOTE]  
> SlotHelper 用「服務帳戶」存取日曆 —— 它是一個機器專用的 Google 帳號，把日曆分享給它就能讀寫。

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. **建立專案**  
   點擊 <kbd>選取專案</kbd> > <kbd>新增專案</kbd>
   取個專案名稱(重複的google會夾一串數字，不喜歡的話可以改個沒人用的) > <kbd>建立</kbd>
3. **啟用 google 日曆**  
   選擇剛剛建立的專案 > 左上角三條線 > API 和服務 > 程式庫 > Google Calendar API > <kbd>啟用</kbd>
4. **建立服務帳戶**  
   左上三條線 > IAM 與管理 > 服務帳戶 > <kbd>+ 建立服務帳戶</kbd>
   範例:
   ```properties
   服務帳戶名稱:弓箭手村美髮店
   服務帳戶ID:calendar-bot
   服務帳戶說明:給 SlotHelper 操作的 google service 帳號
   ```
   \> <kbd>建立並繼續</kbd> > <kbd>繼續</kbd> > <kbd>完成</kbd>
5. **取出私鑰**(機器人會拿這個去製作自己的識別證)  
   服務帳戶 > 選上一步創的服務帳號 > 金鑰頁籤 > <kbd>新增鍵</kbd> > 建立新的金鑰 > JSON > <kbd>建立</kbd> -> (這裡會自動下載 .json)
6. **分享工作日曆給服務帳戶**(沒訂閱 Google One 的帳號只能分享主要日曆)  
   進入 google 日曆 > 我的日曆裡主要日曆右邊三個點 > 設定和共用 > 共用對象 <kbd>+ 新增使用者和群組</kbd> > 貼上服務帳戶的mail；權限選**變更活動**開頭的都可以 > <kbd>傳送</kbd>  
   (順便滾動到下面複製日曆ID，若是用主要日曆，則 ID = gmail郵箱)
7. 回 SlotHelper 後台設定  
   選中剛剛下載的.json(前端會自動帶入私鑰 & google service 帳號)，貼上分享日曆的日曆ID  
   (到店家資訊新增服務項目可以選日曆標籤就代表配置成功囉)
