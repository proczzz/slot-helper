# Telegram

> [!NOTE]
> Telegram 不服務顧客，主要給管理員忘記密碼時使用，並透過這裡接收來自系統的通知與 AI 的求助  
> 為甚麼要用Telegram? 因為 Line 與 Whatsapp 帳號主動發訊息是要收費的(Line 每月前 200 則免費)，而 Telegram bot 只限制速率不收錢，SlotHelper 幫用戶省荷包 <3

1. **新增 Telegram bot**  
   在 Telegram 搜尋 **@BotFather**，依序對他發送 "/start" 、 "/newbot"，BotFather 會引導你配置，通常是依序輸入 機器人顯示名稱(日後可修改)、機器人 ID(唯一標示，會出現在uri)  
   (聊天室左下角有個 <kbd>Open</kbd>，裡面也有UI可以操作)
2. **取得 token**  
   前一步做完時 BotFather 會告訴你，長得像 一串數字:一串亂七八糟的英數字
3. **取得 自己的 Telegram Id**  
   在 Telegarm 搜尋 **@userinfobot**，啟動機器人之後就看的到 ID  
   (此時我們已經有了主動發消息的能力)
4. **Webhook 註冊**  
   SlotHelper 後台 > <kbd>發送測試訊息</kbd> > 收到沒問題後 <kbd>註冊 Webhook</kbd>  
   (註冊時後端會生成 secret，並把 webhook 與 secret 發送給 Telegram，註冊完我們就有了接收消息的能力)
