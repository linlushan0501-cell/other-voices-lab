const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28";
const PROMPT_VERSION = "openai-notion-v1";

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
  const conditionLabel = record.condition === "counterfactual" ? "反事實" : "真實";
  const timeLabel = record.time_point_type === "present" ? "當下" : record.time_point_label;

  return [
    "你是研究工具中的文字生成助手。",
    "請用繁體中文，生成一段第一人稱的虛構他者獨白。",
    "聲音要自然、具體、像角色在回想或理解參與者，不要像研究摘要。",
    "請避免診斷、避免過度解釋心理狀態，也不要替參與者做道德判斷。",
    "",
    `參與者代號：${record.participant_id}`,
    `條件：${conditionLabel}`,
    `時間點類型：${record.time_point_type}`,
    `時間點標籤：${timeLabel}`,
    `角色：${record.character}`,
    `關係：${record.relationship || "-"}`,
    `選角理由：${record.selection_reason || "-"}`,
    `事件描述：${record.event_description}`,
    "",
    "輸出限制：只輸出獨白正文，約 180 到 260 字。開頭可使用角色視角，但不要加標題或條列。",
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
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

  if (!notionKey) {
    throw new Error("Missing NOTION_API_KEY.");
  }

  if (!parentPageId) {
    throw new Error("Missing NOTION_PARENT_PAGE_ID.");
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
        title: [{ type: "text", text: { content: title } }],
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
