<p align="center">
  <img src="https://img.shields.io/github/v/release/proczzz/slot-helper?sort=semver" alt="version" />
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
- **顧客之間訪問權限隔離**：內建的 tools 從根本上阻斷顧客偷看或是變更"不是自己的預約"，不是用提示詞限制而是 AI 手上的工具根本訪問不到 —— 不怕 AI 被顧客哄騙出他人資訊

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

> [!NOTE] 
> 需要自備網域與 TLS 憑證 —— LINE 與 WhatsApp 的 webhook 只接受 HTTPS。  
> 推薦: Nginx + Let's Encrypt(免費憑證)或 Cloudflare Tunnel  
> 資料庫是 SQLite，需要掛一個 volume 到 `/app/data`  

```bash
docker run -d --name slot-helper --restart unless-stopped \
  -p 3000:3000 -v ./data:/app/data \
  ghcr.io/proczzz/slot-helper:latest
```

或 `compose.yaml`：

```yaml
services:
  slot-helper:
    image: ghcr.io/proczzz/slot-helper:latest
    restart: unless-stopped
    init: true
    ports:
      - '3000:3000'
    volumes:
      - ./data:/app/data
```

**首次登入**：管理帳號密碼在容器日誌裡(先訪問登入頁才會生成帳號)，
`docker logs slot-helper` 可以找到。登入後請到「帳號」頁改密碼。

## 串接設定

| 服務 | 用途 |
|---|---|
| [Google 日曆](docs/setup-google-calendar.md) | 寫入預約 |
| [Outlook 行事曆](docs/setup-outlook.md) | 寫入預約 |
| [LINE](docs/setup-line.md) | 接待顧客 |
| [WhatsApp](docs/setup-whatsapp.md) | 接待顧客 |
| [Telegram](docs/setup-telegram.md) | 接收通知、忘記密碼 |

日曆可二選一或不使用，LINE、WhatsApp 至少選一個。

## 更新

### Cloudflare

1. 你的 fork 頁面會顯示「This branch is xxx behind」，右邊按 **Sync fork > Update branch**
2. 等待 Cloudflare 自動部署(過程不停機)，可以查看部署日誌確定沒有報錯

出問題的話，Cloudflare 控制台 > 你的 Worker > **部署(Deployments)** 可以一鍵回到前一版。

### Docker

```bash
# compose
docker compose pull && docker compose up -d

# docker run：拉新 image 後刪掉容器重建，SQLite 在 volume
docker pull ghcr.io/proczzz/slot-helper:latest
docker stop slot-helper && docker rm slot-helper
```

資料表如有變更，會在重啟後第一個請求時自動升級，升級前建議備份 `data/` 目錄。

## 技術棧

- 前端：React + React Router + TanStack Query + Tailwind + daisyUI
- 後端：Hono，同一套邏輯跑在 Node（SQLite）與 Cloudflare Workers（D1）
- AI套件：Vercel AI SDK

## 授權

[MIT](LICENSE)
