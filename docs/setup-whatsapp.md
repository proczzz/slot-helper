# WhatsApp

1. **建立 Meta 應用程式**  
   前往 [Meta for Developers](https://developers.facebook.com/apps) > <kbd>建立應用程式</kbd> 並按照步驟
   - 應用程式詳細資料：輸入應用程式名稱與 email
   - 使用案例：商務式訊息 > 透過 WhatsApp 與顧客建立聯繫
   - 商家：建立或選擇你的商家(需要商家驗證)
   - 要求 & 總覽：(都不用填資料)
2. **取得 Phone Number ID & 存取權杖**  
   主控板會有引導 > 自訂「透過 WhatsApp 與顧客建立聯繫」使用案例 > 步驟1. 試試看 > 兩個都在這  
   (這個權杖是24小時的，開發用)
3. **取得 App secret**  
   左側 應用程式設定 > 基本資料 > 應用程式密鑰
4. **配置 回呼網址 & 驗證權杖**  
   從 SlotHelper 後台拿 Webhook 網址 & 驗證字串 > <kbd>驗證並儲存</kbd> >  
   會跳到別的畫面，回到步驟2. > webhook 欄位裡 messages 要訂閱 > 測試
5. **換永久存取權杖**  
   前往 [Meta Business Suite](https://business.facebook.com/settings/system_users) >  
   用戶 > 系統工作人員 > <kbd>+ 新增</kbd> > System user name: slot-helper；System user role: Employee > <kbd>指派資產</kbd> > 把應用程式與 WhatsApp 帳號都指派給他 > <kbd>產生權杖</kbd> > 選擇應用程式(選 1. 建立的) > 權杖到期時間:永不 > 指派權限: 勾選 `whatsapp_business_management` 與 `whatsapp_business_messaging` > 取得權杖
6. **後續(需要商家驗證)**  
   跟著 Meta 頁面走完步驟(這邊 SlotHelper 開發者走不了流程，未來有借到帳號再補充)
