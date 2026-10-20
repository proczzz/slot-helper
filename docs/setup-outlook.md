# Outlook 行事曆

> [!NOTE]  
> Azure 帳號不等於微軟帳號，如果沒有註冊過 Azure 不要用微軟帳號登入(會噴錯)，要先點免費試用才能註冊  
> 帳號註冊可能需要填寫信用卡，並且微軟會刷 1 美金(應該會刷退)  
> Azure 是註冊應用程式用的，不用跟日曆同一個帳號。後台連結會要求日曆帳號授權給應用程式操作權限

1. **註冊 Azure 帳號**  
   前往 [Azure](https://azure.microsoft.com/)，點擊<kbd>開始使用 Azure</kbd> > <kbd>免費試用 Azure</kbd>
2. **註冊應用程式**  
   點三條線 > Microsoft Entra ID > <kbd>+ 新增</kbd> > 應用程式註冊
   名稱隨意，重新導向 URI 在 SlotHelper 可以複製
   ```properties
   名稱:(隨意取)
   支援的帳戶類型:任何 Entra ID 租用戶 + 個人Microsoft帳戶
   重新導向 URI:在 SlotHelper 後台可以複製
   ```
   \> <kbd>註冊</kbd>
3. **取得帳號**  
   應用程式 (用戶端) 識別碼，複製貼到 SlotHelper 後台
4. **取得密碼**  
   管理 > 憑證及秘密 > <kbd>+ 新增用戶端密碼</kbd> > <kbd>新增</kbd>(最多可以2年過期，過期前要換，最好在日曆上做提醒) > 「值」的欄位就是密碼，貼到 SlotHelper 後台
5. **授權**  
   保存帳號密碼後點擊<kbd>連結 outlook</kbd>，跳轉到微軟允許應用操作日曆，回來後記得選擇要使用的日曆並保存

> 第二步如果忘記填重新導向URI，管理 > Authentication(Preview) >  
> 新增重新導向URI > Web > 貼上 URI 後按設定就好(別的不用動)
