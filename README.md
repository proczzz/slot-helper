<p align="center">
  <img src="https://img.shields.io/github/license/proczzz/slot-helper" alt="MIT" />
</p>

<p align="center">
  <img src="docs/logo.svg" width="240" alt="slot-helper" />
</p>

<h1 align="center">slot-helper</h1>

<p align="center">
  串接了 google 日曆、outlook 行事曆、Line、Whatsapp、Telegram，的AI客服助理
</p>

## 介紹

SlotHelper 是針對預約客服特別優化過的 agent  

- **彌補AI數學不好的短板**：日曆有哪些空檔、排的進哪些服務都由後端計算好，AI不用知道時區、不用計算預約開始與結束時間
- **顧客之間訪問權限隔離**：內建的 tools 從根本上阻斷顧客偷看或是變更"不是自己的預約"，不是用提示詞限制而是 AI 手上的工具根本訪問不到 -- 不怕 AI 被顧客哄騙出他人資訊

一人美髮、按摩、工作室，常見的狀況是：訊息都進 LINE，老闆在服務客人時沒空回，回過頭已經錯過多位客戶。

slot-helper 讓 AI 處理這些訊息 —— 它看得到你的營業時間、服務項目與行事曆，確認時間與項目之後替顧客安排預約並寫進日曆。

- **用你自己的 AI 金鑰**：SlotHelper 由你架設且不會收取任何中間費用或抽成。可以配置多個AI key，若失效或餘額不足自動遞補並通知你
- **資料在你手上**：沒有中間伺服器。對話、顧客、設定都在你的 Cloudflare 帳號或你自己的伺服器裡
- **真的會寫日曆**：Google 日曆或 Outlook行事曆，不是只會聊天
- **你隨時能接手**：後台可以暫停選定顧客的 AI 服務，由負責人自行在 LINE 上回他
- **可設定閾值**：同一位顧客短時間問太多次自動暫停，避免 AI 費用爆漲
- **出事會通知你**：AI 金鑰失效、系統錯誤、顧客被暫停，都用 Telegram 告知

## 安裝

支援 Nodejs (提供 Docker image) 與 Cloudflare Worker 兩種運行環境

### A. Cloudflare Workers

Cloudflare 提供免費 V8 JS 運行環境，不用自己買設備、不用管伺服器，更新只要按一個按鈕。

1. **Fork 這個專案** → [建立 fork](https://github.com/proczzz/slot-helper/fork)
2. 登入 [Cloudflare 控制台](https://dash.cloudflare.com)，左側選 **運算 → Workers 和 Pages → 建立應用程式 → Continue with GitHub**
3. 授權 GitHub，選剛剛 fork 的 `slot-helper`
4. 設定不用改，按 <kbd>部署</kbd> 。(D1 資料庫會自動建立。Cloudflare 會送你三級域名 & 伺服器憑證唷，非常省心~)
5. 等待部署完成後點擊 <kbd>造訪</kbd> ，或是訪問`https://slot-helper.<你的帳號>.workers.dev`

**首次登入**：管理帳號密碼在系統日誌裡(先訪問 SlotHelper 登入頁才會生成帳號哦) ——  
Cloudflare 控制台 → 你的 Worker → **Observability**，  
日誌內會包含隨機密碼。登入後請到「帳號」頁改密碼。  

### B. Docker（自己的伺服器或 VPS）

(編輯中...)

## 設定

(編輯中...)

## 更新

### Cloudflare

1. 你的 fork 頁面會顯示「This branch is xxx behind」，右邊按 **Sync fork → Update branch**
2. 等待 Cloudflare 自動部署(過程不停機)，可以查看部署日誌確定沒有報錯

出問題的話，Cloudflare 控制台 → 你的 Worker → **部署(Deployments)** 可以一鍵回到前一版。

### Docker

(編輯中...)

## 技術棧

- 前端：React + React Router + TanStack Query + Tailwind + daisyUI
- 後端：Hono，同一套邏輯跑在 Node（SQLite）與 Cloudflare Workers（D1）
- AI套件：Vercel AI SDK

## 授權

[MIT](LICENSE)
