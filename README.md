# Research Monologue Dashboard

研究者端第一版靜態網頁原型。這一版先用純 HTML/CSS/JavaScript 完成版面與操作流程，方便先上 GitHub / Vercel 檢查介面，再進入 OpenAI 與 Notion API 串接。

## 使用方式

直接用瀏覽器打開 `index.html`。

也可以用任何靜態伺服器預覽，例如：

```bash
python3 -m http.server 3000
```

然後打開 `http://localhost:3000`。

## 目前範圍

- 參與者、事件、時間點、他者角色輸入
- 單筆模擬生成
- 角色 x 條件 x 時間點進度矩陣
- 內容審閱、編輯、核可、標記問題、退回重生
- 使用 `localStorage` 保存目前資料

## 後續 API 串接

這版不放 OpenAI 或 Notion API key，因為純前端不能安全保存金鑰。

下一階段可升級為 Next.js / Vercel Serverless API：

1. 建立 `/api/generate` 組 prompt 並呼叫 OpenAI。
2. 建立 `/api/notion` 或在 generate route 中寫入 Notion。
3. 將目前 `script.js` 的 `createMockGeneration()` 換成 API call。

## Vercel

這是靜態網站。把 repository 匯入 Vercel 即可部署，不需要環境變數。
