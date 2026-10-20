# LINE

1. **註冊 Line biz 帳號**  
   前往 [Line 台灣](https://tw.linebiz.com/)，登入管理頁面 or 免費開設帳號
2. **停用自動回應訊息**  
   設定 > 回應設定 > 停用自動回應訊息(預設是開啟的，要把它關閉)
3. **啟用 Message API**  
   設定 > Messaging API > <kbd>啟用 Messaging API</kbd> (服務提供者可填所屬單位或組織名稱)
4. **進入開發者頁面**  
   前往 [LINE Developers Console](https://developers.line.biz/console/)，選取你的 provider 與 Channel
5. **取得 Channel secret**  
   Basic Settings > 下方可以找到
6. **取得 Channel access token**  
   Messaging API > 下方找到 Channel access token > <kbd>Issue</kbd> 產生一個
7. **配置並啟用Webhook**  
   Messaging API > 下方找到 Webhook URL > 從 SlotHelper 後台取得並貼上 > 點 <kbd>Verify</kbd> 驗證 > 下方 Use webhook 啟用
