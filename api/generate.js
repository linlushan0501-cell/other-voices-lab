const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2026-03-11";
const PROMPT_VERSION = "openai-notion-v2";

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function trimText(value, maxLength = 1900) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function notionRichText(value) {
  return [{ type: "text", text: { content: trimText(value) || "-" } }];
}

function notionTitle(value) {
  return [{ type: "text", text: { content: trimText(value, 240) || "Generated record" } }];
}

function getConditionLabel(condition) {
  return condition === "counterfactual" ? "反事實" : "真實";
}

function getTimePointLabel(timePointType) {
  const labels = {
    past: "過去",
    present: "當下",
    future: "未來",
  };
  return labels[timePointType] || timePointType;
}

function extractOpenAiText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = payload.output?.flatMap((item) => item.content || []) || [];
  const text = parts
    .map((part) => part.text || part.output_text || "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || "生成完成，但 OpenAI 回應沒有可讀文字。";
}

function buildPrompt(record) {
  const conditionLabel = getConditionLabel(record.condition);
  const timeLabel = record.time_point_type === "present" ? "當下" : record.time_point_label;
  const selectedScenario =
    record.condition === "counterfactual"
      ? record.counterfactual_event_description || record.event_description
      : record.real_event_description || record.event_description;
  const contrastScenario =
    record.condition === "counterfactual" ? record.real_event_description : record.counterfactual_event_description;
  const timePointGuidance = {
    past: "past：把時間點當成角色當時所在的場景。寫出那時已經能看見的細節、預感、關係張力；不要用回顧報告腔。",
    present: "present：直接站在事件當下。讓角色正在看見、聽見、忍住、靠近或退開；不要解釋設定。",
    future: "future：把未來時間點當成已經抵達的生活現場。寫後來留下的痕跡與關係變化；不要寫「到了某年」或預測句。",
  };

  return [
    "任務：生成一段繁體中文的第一人稱虛構他者獨白。",
    "敘事者是「角色」本人，不是研究者，也不是參與者。角色要用自己的關係位置、知道的事情、語氣和盲點說話。",
    "反事實不是角色本身的反事實；反事實只代表「關鍵事件情境」改成使用者輸入的反事實版本。角色仍然是同一個敘事視角。",
    "真實條件只根據真實關鍵事件；反事實條件只根據反事實關鍵事件。不要把兩個情境混成角色自己的如果人生。",
    "",
    "時間處理：",
    timePointGuidance.past,
    timePointGuidance.present,
    timePointGuidance.future,
    `本次要使用的時間類型：${record.time_point_type}`,
    `本次時間點標籤：${timeLabel}`,
    "不要直接說出時間點標籤；把它轉成場景裡自然存在的痕跡、身體感、日常細節或關係變化。",
    "",
    "語氣與結構限制：",
    "不要用「如果...」作為開頭，也不要用「我想，到了...」「在某年...」「假如我是...」這種把設定念出來的句子。",
    "第一句必須直接進入角色的身體動作、感官細節、正在忍住的話，或對參與者的具體反應。",
    "不要說明你正在使用真實、反事實、過去、當下、未來這些欄位。",
    "不要每次都用同一種句型。依角色關係調整距離感：親密角色可以有遲疑、責備、心疼；較遠角色可以有克制、旁觀、誤解。",
    "避免研究摘要、診斷、人生建議、道德評判。不要把症狀或團體反應講成通用模板。",
    "直接進入第一人稱現場，可以稱呼參與者為「你」，但要符合角色關係。",
    "",
    "本次生成資料：",
    `參與者代號：${record.participant_id}`,
    `條件：${conditionLabel}`,
    `角色：${record.character}`,
    `角色關係：${record.relationship || "-"}`,
    `選角理由：${record.selection_reason || "-"}`,
    `本次應採用的事件情境：${selectedScenario}`,
    `另一個情境僅供區分，不可混用：${contrastScenario || "-"}`,
    "",
    "輸出限制：只輸出獨白正文，約 160 到 240 字。不要加標題、括號註解、欄位名稱或條列。",
  ].join("\n");
}

async function createOpenAiText(record) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-5.5",
      input: buildPrompt(record),
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI generation failed.");
  }

  return extractOpenAiText(payload);
}

async function createNotionPage(record) {
  const notionKey = process.env.NOTION_API_KEY;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

  if (!notionKey) {
    throw new Error("Missing NOTION_API_KEY.");
  }

  if (dataSourceId) {
    return createNotionTableRow(record, notionKey, dataSourceId);
  }

  if (!parentPageId) {
    throw new Error("Missing NOTION_DATA_SOURCE_ID or NOTION_PARENT_PAGE_ID.");
  }

  const title = `${record.participant_id} / ${record.condition} / ${record.time_point_type} / ${record.character}`;
  const fields = [
    ["participant_id", record.participant_id],
    ["condition", record.condition],
    ["time_point_type", record.time_point_type],
    ["time_point_label", record.time_point_label],
    ["character", record.character],
    ["prompt_version", record.prompt_version],
    ["generated_text", record.generated_text],
    ["generated_image_url", record.generated_image_url || ""],
    ["timestamp", record.timestamp],
  ];

  const response = await fetch(NOTION_PAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { page_id: parentPageId },
      properties: {
        title: notionTitle(title),
      },
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: notionRichText("Generated Record") },
        },
        ...fields.map(([label, value]) => ({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: notionRichText(`${label}: ${value || ""}`) },
        })),
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Notion page creation failed.");
  }

  return payload.url || "";
}

async function createNotionTableRow(record, notionKey, databaseId) {
  const conditionLabel = getConditionLabel(record.condition);
  const timeCategoryLabel = getTimePointLabel(record.time_point_type);
  const properties = {
    participant_id: { title: notionTitle(record.participant_id) },
    condition: { rich_text: notionRichText(conditionLabel) },
    time_point_type: { select: { name: conditionLabel } },
    time_point_label: { select: { name: timeCategoryLabel } },
    character: { rich_text: notionRichText(record.character) },
    generated_text: { rich_text: notionRichText(record.generated_text) },
    "image URL": { url: record.generated_image_url || null },
    time: { date: { start: record.timestamp } },
    prompt_version: { rich_text: notionRichText(record.prompt_version) },
  };

  if (record.generated_image_url) {
    properties.image = {
      files: [
        {
          name: "generated image",
          type: "external",
          external: { url: record.generated_image_url },
        },
      ],
    };
  }

  const response = await fetch(NOTION_PAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionKey}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Notion table row creation failed.");
  }

  return payload.url || "";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
    const record = {
      participant_id: trimText(body.participant_id, 120),
      condition: trimText(body.condition, 80),
      time_point_type: trimText(body.time_point_type, 80),
      time_point_label: trimText(body.time_point_label, 240),
      character: trimText(body.character, 160),
      relationship: trimText(body.relationship, 240),
      selection_reason: trimText(body.selection_reason, 500),
      event_description: trimText(body.event_description, 1600),
      real_event_description: trimText(body.real_event_description, 1600),
      counterfactual_event_description: trimText(body.counterfactual_event_description, 1600),
      prompt_version: body.prompt_version || PROMPT_VERSION,
      generated_image_url: "",
      timestamp: new Date().toISOString(),
    };

    if (!record.participant_id || !record.condition || !record.time_point_type || !record.character || !record.event_description) {
      sendJson(response, 400, { error: "Missing required generation fields." });
      return;
    }

    const generatedText = await createOpenAiText(record);
    const completedRecord = {
      ...record,
      generated_text: generatedText,
    };
    const notion_url = await createNotionPage(completedRecord);

    sendJson(response, 200, {
      generation: {
        id: body.id,
        participantId: body.participantId,
        participantCode: record.participant_id,
        characterId: body.characterId,
        characterName: record.character,
        relationship: record.relationship,
        selectionReason: record.selection_reason,
        condition: record.condition,
        timePointType: record.time_point_type,
        timePointValue: record.time_point_label,
        generatedContent: generatedText,
        generatedImageUrl: record.generated_image_url,
        generationTimestamp: record.timestamp,
        promptVersion: record.prompt_version,
        notionUrl: notion_url,
      },
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Generation failed." });
  }
}
