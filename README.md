<p align="center">
  <img src="https://img.shields.io/github/license/proczzz/slot-helper" alt="MIT" />
</p>

<p align="center">
  <img src="docs/logo.svg" width="240" alt="slot-helper" />
</p>

<h1 align="center">SlotHelper</h1>

<p align="center">
  串接了 google 日曆、outlook 行事曆、Line、Whatsapp、Telegram 的 AI 客服助理
</p>

## 介紹

SlotHelper 是針對預約客服特別優化過的 agent  

- **彌補AI數學不好的短板**：日曆有哪些空檔、排的進哪些服務都由後端計算好，AI不用知道時區、不用計算預約開始與結束時間
- **顧客之間訪問權限隔離**：內建的 tools 從根本上阻斷顧客偷看或是變更"不是自己的預約"，不是用提示詞限制而是 AI 手上的工具根本訪問不到 -- 不怕 AI 被顧客哄騙出他人資訊

一人美髮、按摩、工作室，常見的狀況是：訊息都進 LINE，老闆在服務客人時沒空回，回過頭已經錯過多位客戶。

SlotHelper 讓 AI 處理這些訊息 —— 它看得到你的營業時間、服務項目與行事曆，確認時間與項目之後替顧客安排預約並寫進日曆。

- **用你自己的 AI 金鑰**：SlotHelper 由你架設且不會收取任何中間費用或抽成。可以配置多個AI key，若失效或餘額不足自動遞補並通知你
- **資料在你手上**：沒有中間伺服器。對話、顧客、設定都在你的 Cloudflare 帳號或你自己的伺服器裡
- **真的會寫日曆**：Google 日曆或 Outlook行事曆，不是只會聊天
- **你隨時能接手**：後台可以暫停選定顧客的 AI 服務，由負責人自行在 LINE 上回他
- **可設定閾值**：同一位顧客短時間問太多次自動暫停，避免 AI 費用暴漲
- **出事會通知你**：AI 金鑰失效、系統錯誤、顧客被暫停，都用 Telegram 告知

## 安裝

支援 Nodejs (提供 Docker image) 與 Cloudflare Worker 兩種運行環境

### A. Cloudflare Workers

Cloudflare 提供免費 V8 JS 運行環境，不用自己買設備、不用管伺服器，更新只要按一個按鈕。

1. **Fork 這個專案**  
    [建立 fork](https://github.com/proczzz/slot-helper/fork) ⚠️ 請**取消勾選**「Copy the `main` branch only」，否則 fork 不會包含 `stable` 分支
2. **更換 stable 為主要分支**  
    到 fork 的專案，選擇 Settings > Default branch 點擊 <kbd>⇄</kbd> 選 stable
3. **部署專案**  
    登入 [Cloudflare 控制台](https://dash.cloudflare.com)，左側選單 > 運算 > Workers 和 Pages > 建立應用程式 > Continue with GitHub > 授權 GitHub (如果還沒連結) > 選剛剛 fork 的 `slot-helper` > 設定不用改直接 <kbd>部署</kbd>
4. **等待**  
    可以檢查 log 有沒有出問題，大概半分鐘內完成。  
    (D1 資料庫會自動建立。Cloudflare 會送你三級域名 & 伺服器憑證唷，非常省心~)
5. **前往後台**  
    等待部署完成後點擊 <kbd>造訪</kbd> ，或是訪問`https://slot-helper.<你的帳號>.workers.dev`

**首次登入**：管理帳號密碼在系統日誌裡(先訪問 SlotHelper 登入頁才會生成帳號哦) ——  
Cloudflare 控制台 > 你的 Worker > **Observability**，  
日誌內會包含隨機密碼。登入後請到「帳號」頁改密碼。  

### B. Docker（自己的伺服器或 VPS）

(編輯中...)

## 串接設定

### Google 日曆

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

### Outlook 行事曆

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

### Line

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

### WhatsApp

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

### Telegram

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

## 更新

### Cloudflare

1. 你的 fork 頁面會顯示「This branch is xxx behind」，右邊按 **Sync fork > Update branch**
2. 等待 Cloudflare 自動部署(過程不停機)，可以查看部署日誌確定沒有報錯

出問題的話，Cloudflare 控制台 > 你的 Worker > **部署(Deployments)** 可以一鍵回到前一版。

### Docker

(編輯中...)

## 技術棧

- 前端：React + React Router + TanStack Query + Tailwind + daisyUI
- 後端：Hono，同一套邏輯跑在 Node（SQLite）與 Cloudflare Workers（D1）
- AI套件：Vercel AI SDK

## 授權

[MIT](LICENSE)
