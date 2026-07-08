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
- 單筆 OpenAI 生成
- 角色 x 條件 x 時間點進度矩陣
- 生成結果列表
- 使用 `localStorage` 保存目前資料

## OpenAI / Notion API 串接

這版透過 Vercel Function 呼叫 OpenAI 與 Notion。OpenAI 或 Notion API key 不會放在前端，必須設定在 Vercel 的 Environment Variables。

必要環境變數：

```bash
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-5.5
OPENAI_IMAGE_MODEL=gpt-image-2
NOTION_API_KEY=
NOTION_PARENT_PAGE_ID=
```

生成流程：

1. 前端呼叫 `/api/generate`。
2. Vercel Function 組 prompt 並呼叫 OpenAI Responses API。
3. 生成完成後，自動在 `NOTION_PARENT_PAGE_ID` 底下建立 Notion page 紀錄。
4. 前端收到結果並更新 localStorage 與生成紀錄。

## Vercel

把 repository 匯入 Vercel 後，先在 Project Settings 設定上述環境變數，再 redeploy。更新程式後，commit 並 push 到 GitHub，Vercel 會自動重新部署。
