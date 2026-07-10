const steps = [
  { id: "participant", label: "參與者", title: "welcome" },
  { id: "event-type", label: "類型", title: "生命中的關鍵事件" },
  { id: "event", label: "事件", title: "Monologue of Fictional Others" },
  { id: "characters", label: "他者", title: "Monologue of Fictional Others" },
  { id: "generate", label: "生成", title: "Monologue of Fictional Others" },
];

const conditions = ["real", "counterfactual"];
const timePoints = ["past", "present", "future"];
const designFrame = {
  width: 1512,
  height: 982,
  generateHeight: 1568,
};
const eventTypes = [
  {
    value: "生理需求",
    title: "生理需求",
    description: "哪一次的生病、極度疲憊或身體創傷，讓你發現原來活著、健康不是理所當然的？",
  },
  {
    value: "安全需求",
    title: "安全需求",
    description: "哪一個時期或事件，讓你覺得生活失去了控制，甚至連下一步該踩在哪裡都感到不安全？",
  },
  {
    value: "愛與歸屬",
    title: "愛與歸屬",
    description: "在哪個群體（家庭、校園、職場）中，你經歷了最深刻的我屬於這裡或我被排擠在外的時刻？",
  },
  {
    value: "尊重需求",
    title: "尊重需求",
    description: "哪一次的成就（被肯定）或失敗（被否定），最劇烈地搖晃了你對自己能力的評價？",
  },
  {
    value: "自我實現",
    title: "自我實現",
    description: "在哪個瞬間，你放下了賺錢、旁人眼光等現實考量，單純因為這是我真正想活出的模樣？",
  },
];
const storageKey = "research-monologue-dashboard-static-v1";
const accessCodeKey = `${storageKey}-access-code`;
const uiVersion = "figma-flow-v2";
const promptVersion = "openai-notion-v3";
const promptVersionReason =
  "v3: 避免複述使用者輸入的敘事內文；要求物件、場景與日常細節必須有角色脈絡；增加獨白形式、口吻與語氣變化。";
const promptVersionReasonKey = `${storageKey}-${promptVersion}-reason`;

const labels = {
  real: "真實",
  counterfactual: "反事實",
  past: "過去",
  present: "當下",
  future: "未來",
};

const recordTimeLabels = {
  ...labels,
  present: "現在",
};

function createCharacter(index) {
  return { id: `character-${index}`, name: "", relationship: "", selectionReason: "" };
}

function createParticipant(index) {
  return {
    id: `participant-${Date.now()}-${index}`,
    code: `P-${String(index).padStart(3, "0")}`,
    interviewDate: "",
    eventType: eventTypes[0].value,
    realEventDescription: "",
    counterfactualDescription: "",
    realPastTimePoint: "",
    realFutureTimePoint: "",
    counterfactualPastTimePoint: "",
    counterfactualFutureTimePoint: "",
    characters: [createCharacter(1), createCharacter(2)],
  };
}

const firstParticipant = createParticipant(1);

const defaultState = {
  uiVersion,
  activeStep: "participant",
  activeParticipantId: firstParticipant.id,
  selectedCondition: "real",
  selectedTimePoint: "present",
  selectedEventType: firstParticipant.eventType,
  selectedCharacterId: "character-1",
  participants: [firstParticipant],
  generations: [],
};

let state = loadState();

function cloneDefaultState() {
  return structuredClone(defaultState);
}

function normalizeParticipant(participant, index = 1) {
  const next = { ...createParticipant(index), ...participant };
  const legacyPast = participant?.pastTimePoint || "";
  const legacyFuture = participant?.futureTimePoint || "";
  if (!next.code?.trim()) {
    next.code = `P-${String(index).padStart(3, "0")}`;
  }
  next.realPastTimePoint ||= legacyPast;
  next.eventType ||= eventTypes[0].value;
  next.realFutureTimePoint ||= legacyFuture;
  next.counterfactualPastTimePoint ||= legacyPast;
  next.counterfactualFutureTimePoint ||= legacyFuture;
  next.characters = next.characters?.length ? next.characters : [createCharacter(1), createCharacter(2)];
  return next;
}

function loadState() {
  try {
    const value = localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : {};
    const participants = parsed.participants?.length
      ? parsed.participants.map(normalizeParticipant)
      : [normalizeParticipant(parsed.participant || {}, 1)];

    const activeParticipantId = parsed.activeParticipantId || participants[0].id;
    const activeParticipant = getActiveParticipantFromState({ participants, activeParticipantId });
    const next = {
      ...cloneDefaultState(),
      ...parsed,
      uiVersion,
      participants,
      activeParticipantId,
      selectedEventType: parsed.selectedEventType || activeParticipant.eventType,
      generations: parsed.generations || [],
    };

    if (parsed.uiVersion !== uiVersion) {
      next.activeStep = "participant";
    }

    if (!participants.some((participant) => participant.id === next.activeParticipantId)) {
      next.activeParticipantId = participants[0].id;
    }

    if (!steps.some((step) => step.id === next.activeStep)) {
      next.activeStep = "participant";
    }

    if (!getActiveParticipantFromState(next).characters.some((character) => character.id === next.selectedCharacterId)) {
      next.selectedCharacterId = getActiveParticipantFromState(next).characters[0]?.id || "";
    }

    if (parsed.uiVersion !== uiVersion) {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }

    return next;
  } catch {
    return cloneDefaultState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function byId(id) {
  return document.getElementById(id);
}

function getActiveParticipantFromState(sourceState) {
  return (
    sourceState.participants.find((participant) => participant.id === sourceState.activeParticipantId) ||
    sourceState.participants[0]
  );
}

function getActiveParticipant() {
  return getActiveParticipantFromState(state);
}

function getActiveGenerations() {
  const participant = getActiveParticipant();
  return state.generations.filter((generation) => generation.participantId === participant.id);
}

function setStep(stepId) {
  state.activeStep = stepId;
  saveState();
  render();
}

function updateViewportScale() {
  const isGenerateStep = state.activeStep === "generate";
  const scale = isGenerateStep
    ? Math.min(window.innerWidth / designFrame.width, 1)
    : Math.min(window.innerWidth / designFrame.width, window.innerHeight / designFrame.height, 1);

  document.documentElement.style.setProperty("--design-scale", String(scale));
  document.body.style.minHeight = isGenerateStep ? `${designFrame.generateHeight * scale}px` : "100vh";
}

function setActiveParticipant(participantId) {
  state.activeParticipantId = participantId;
  const participant = getActiveParticipant();
  state.selectedEventType = participant.eventType;
  state.selectedCharacterId = participant.characters[0]?.id || "";
  saveState();
  render();
}

function updateParticipant(field, value) {
  const participant = getActiveParticipant();
  state.participants = state.participants.map((item) =>
    item.id === participant.id ? { ...item, [field]: value } : item,
  );
  saveState();
  renderGeneratedViews();
}

function updateCharacter(id, field, value) {
  const participant = getActiveParticipant();
  const characters = participant.characters.map((character) =>
    character.id === id ? { ...character, [field]: value } : character,
  );

  state.participants = state.participants.map((item) => (item.id === participant.id ? { ...item, characters } : item));

  if (!characters.some((character) => character.id === state.selectedCharacterId)) {
    state.selectedCharacterId = characters[0]?.id || "";
  }

  saveState();
  renderGeneratedViews();
}

function getSelectedCharacter() {
  const participant = getActiveParticipant();
  return participant.characters.find((character) => character.id === state.selectedCharacterId) || participant.characters[0];
}

function getScenarioDescription(condition) {
  const participant = getActiveParticipant();
  return condition === "real" ? participant.realEventDescription : participant.counterfactualDescription;
}

function getEventTypeLabel(value) {
  return eventTypes.find((eventType) => eventType.value === value)?.title || value || eventTypes[0].title;
}

function getTimePointValue(condition, timePoint) {
  const participant = getActiveParticipant();
  if (timePoint === "present") return "當下";
  if (condition === "real" && timePoint === "past") return participant.realPastTimePoint;
  if (condition === "real" && timePoint === "future") return participant.realFutureTimePoint;
  if (condition === "counterfactual" && timePoint === "past") return participant.counterfactualPastTimePoint;
  return participant.counterfactualFutureTimePoint;
}

function generationId(participantId, characterId, condition, timePoint) {
  return `${participantId}-${characterId}-${condition}-${timePoint}`;
}

function hashText(value) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function pickVariant(items, seed, offset = 0) {
  return items[(hashText(seed) + offset) % items.length];
}

function getCurrentGeneration() {
  const participant = getActiveParticipant();
  const character = getSelectedCharacter();
  if (!character) return null;
  return state.generations.find(
    (generation) =>
      generation.participantId === participant.id &&
      generation.characterId === character.id &&
      generation.condition === state.selectedCondition &&
      generation.timePointType === state.selectedTimePoint,
  );
}

function hasRequiredGenerationData() {
  const character = getSelectedCharacter();
  const condition = state.selectedCondition;
  const timePoint = state.selectedTimePoint;
  const hasScenario = Boolean(getScenarioDescription(condition).trim());
  const hasTimePoint = timePoint === "present" || Boolean(getTimePointValue(condition, timePoint).trim());

  return Boolean(hasScenario && hasTimePoint && character?.name.trim());
}

function createMockGeneration() {
  const participant = getActiveParticipant();
  const character = getSelectedCharacter();
  const condition = state.selectedCondition;
  const timePointType = state.selectedTimePoint;
  const eventText = getScenarioDescription(condition);
  const timePointValue = getTimePointValue(condition, timePointType);
  const seed = generationId(participant.id, character.id, condition, timePointType);
  const eventFragment = eventText.trim().slice(0, 56);
  const roleName = character.name || "未命名角色";
  const relationship = character.relationship || "這段關係";
  const observation = pickVariant(
    [
      `我看到他把話講到一半又收回去，像是怕多講一句就會把自己弄得更狼狽。`,
      `我記得他那天一直避開我的眼神，手上明明沒什麼事，卻反覆整理同一個地方。`,
      `他笑得很快，快到我反而知道那不是沒事，是他不想讓場面變得太重。`,
      `我注意到他停了一下，那個停頓很短，可是我知道他其實吞回去很多話。`,
      `看到他把肩膀縮起來的時候，我心裡有點酸，因為那不是第一次了。`,
    ],
    seed,
  );
  const timeVoice = {
    past: [
      `回頭看${timePointValue ? `「${timePointValue}」` : "那之前"}，我才發現有些訊號其實很早就出現了。`,
      `${timePointValue ? `在「${timePointValue}」那一段` : "在更早以前"}，他還沒有把自己逼到那麼緊，可是已經很少真正放鬆。`,
      `如果從${timePointValue ? `「${timePointValue}」` : "前面那段時間"}說起，我最記得的是他總把難受講得很輕。`,
    ],
    present: [
      `當下我沒有急著問，因為我知道他一被追問，就會立刻把話收乾淨。`,
      `當下那個氣氛很薄，好像誰多碰一下，他就會把自己關起來。`,
      `當下我其實想靠近一點，可是又怕我的關心變成另一種壓力。`,
    ],
    future: [
      `後來到了${timePointValue ? `「${timePointValue}」` : "更後面"}，我還是會想起他那個表情。`,
      `${timePointValue ? `「${timePointValue}」以後` : "很久以後"}，我才慢慢懂，他那時候要的不是答案，是有人真的站在他旁邊。`,
      `再往後看，我覺得他會記得的不是誰說了什麼大道理，而是那時有沒有人願意等他一下。`,
    ],
  };
  const conditionVoice =
    condition === "counterfactual"
      ? pickVariant(
          [
            `如果那時候換一種走法，他大概不會馬上變得輕鬆，但至少不用一路假裝自己撐得住。`,
            `要是當時不是那樣發展，他可能還是會嘴硬，只是心裡不會那麼早就覺得自己被丟下。`,
            `如果那個轉折沒有壓過來，我想他會多留一點力氣給自己，而不是急著證明他沒問題。`,
          ],
          seed,
          2,
        )
      : pickVariant(
          [
            `我知道那不是小題大作，因為我看過他怎麼把難受藏成一句「還好」。`,
            `他很少直接說自己受傷，所以我只能從那些小動作裡慢慢猜。`,
            `我不是每次都懂他，可是那一刻我知道，他其實已經忍很久了。`,
          ],
          seed,
          3,
        );
  const ending = pickVariant(
    [
      `以${relationship}的位置來說，我最放不下的，是我那時候有沒有真的看見他。`,
      `我後來一直想，如果我能少講一點道理、多陪他一下，也許他會比較敢把話說完。`,
      `所以我記住的不是完整經過，而是他那個樣子，還有我當時差一點就忽略的沉默。`,
      `那句「${eventFragment || "他沒有說完的話"}」我到後來還會想起，因為裡面其實藏著很多他不敢直接要的東西。`,
    ],
    seed,
    4,
  );

  return {
    id: generationId(participant.id, character.id, condition, timePointType),
    participantId: participant.id,
    participantCode: participant.code,
    eventType: getEventTypeLabel(participant.eventType),
    characterId: character.id,
    characterName: character.name || "未命名角色",
    relationship: character.relationship,
    selectionReason: character.selectionReason,
    condition,
    timePointType,
    timePointValue,
    generatedContent: `【${roleName}】${observation}${pickVariant(timeVoice[timePointType], seed, 1)}${conditionVoice}${ending}`,
    generationTimestamp: new Date().toISOString(),
    promptVersion: "static-prototype-v3",
  };
}

function createGenerationRequest() {
  const participant = getActiveParticipant();
  const character = getSelectedCharacter();
  const condition = state.selectedCondition;
  const timePointType = state.selectedTimePoint;
  const timePointValue = getTimePointValue(condition, timePointType);
  const shouldRecordPromptVersionReason = localStorage.getItem(promptVersionReasonKey) !== "recorded";

  return {
    id: generationId(participant.id, character.id, condition, timePointType),
    participantId: participant.id,
    participant_id: participant.code,
    event_type: getEventTypeLabel(participant.eventType),
    characterId: character.id,
    character: character.name,
    relationship: character.relationship || character.name,
    selection_reason: character.selectionReason,
    condition,
    time_point_type: timePointType,
    time_point_label: timePointValue,
    event_description: getScenarioDescription(condition),
    real_event_description: participant.realEventDescription,
    counterfactual_event_description: participant.counterfactualDescription,
    prompt_version: promptVersion,
    prompt_version_reason: shouldRecordPromptVersionReason ? promptVersionReason : "",
  };
}

async function createApiGeneration() {
  const request = createGenerationRequest();
  const accessCode = sessionStorage.getItem(accessCodeKey) || "";
  if (!accessCode) {
    lockApp("請先輸入研究者存取碼。");
    throw new Error("請先輸入研究者存取碼。");
  }

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-access-code": accessCode,
    },
    body: JSON.stringify(request),
  });

  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 503) {
      sessionStorage.removeItem(accessCodeKey);
      lockApp(payload.error || "請重新輸入研究者存取碼。");
    }
    throw new Error(payload.error || "生成失敗，請稍後再試。");
  }

  if (request.prompt_version_reason) {
    localStorage.setItem(promptVersionReasonKey, "recorded");
  }

  return payload.generation;
}

function unlockApp(accessCode) {
  sessionStorage.setItem(accessCodeKey, accessCode);
  document.body.classList.remove("is-locked");
  byId("access-gate").hidden = true;
  byId("access-message").textContent = "";
}

function lockApp(message = "") {
  document.body.classList.add("is-locked");
  byId("access-gate").hidden = false;
  byId("access-message").textContent = message;
}

function bindAccessGate() {
  byId("access-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const codeInput = byId("access-code");
    const code = codeInput.value.trim();
    const message = byId("access-message");

    if (!code) {
      message.textContent = "請輸入存取碼。";
      return;
    }

    unlockApp(code);
    codeInput.value = "";
  });
}

function restoreAccessSession() {
  const code = sessionStorage.getItem(accessCodeKey);
  if (!code) {
    lockApp();
    return;
  }

  unlockApp(code);
}

function upsertGeneration(generation) {
  state.generations = [...state.generations.filter((item) => item.id !== generation.id), generation];
  saveState();
}

function renderNavigation() {
  byId("nav").innerHTML = steps
    .map(
      (step, index) =>
        `<button class="${state.activeStep === step.id ? "active" : ""}" data-step="${step.id}" type="button"><span>${String(
          index + 1,
        ).padStart(2, "0")}</span>${step.label}</button>`,
    )
    .join("");

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => setStep(button.dataset.step));
  });
}

function renderEventTypes() {
  const participant = getActiveParticipant();
  const list = byId("event-type-list");
  if (!list) return;
  list.innerHTML = eventTypes
    .map(
      (eventType) => `
        <button class="event-type-card ${participant.eventType === eventType.value ? "active" : ""}" data-event-type="${
          eventType.value
        }" type="button">
          <strong>${eventType.title}</strong>
          <span>${eventType.description}</span>
        </button>`,
    )
    .join("");

  list.querySelectorAll("[data-event-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedEventType = button.dataset.eventType;
      updateParticipant("eventType", button.dataset.eventType);
      render();
    });
  });
}

function renderStepVisibility() {
  const current = steps.find((step) => step.id === state.activeStep);
  document.body.dataset.step = state.activeStep;
  updateViewportScale();
  byId("page-title").textContent = current.title;
  steps.forEach((step) => {
    byId(`${step.id}-step`).classList.toggle("hidden", step.id !== state.activeStep);
  });
}

function renderParticipantSelect() {
  byId("participant-select").innerHTML = state.participants
    .map((participant, index) => {
      const label = participant.code.trim() || `P-${String(index + 1).padStart(3, "0")}`;
      return `<option value="${participant.id}" ${participant.id === state.activeParticipantId ? "selected" : ""}>${label}</option>`;
    })
    .join("");
  byId("delete-participant").disabled = state.participants.length <= 1;
}

function renderForms() {
  const participant = getActiveParticipant();
  renderParticipantSelect();
  byId("participant-code").value = participant.code;
  byId("interview-date").value = participant.interviewDate;
  byId("real-event").value = participant.realEventDescription;
  byId("counterfactual-event").value = participant.counterfactualDescription;
  byId("real-past-time").value = participant.realPastTimePoint;
  byId("real-future-time").value = participant.realFutureTimePoint;
  byId("counterfactual-past-time").value = participant.counterfactualPastTimePoint;
  byId("counterfactual-future-time").value = participant.counterfactualFutureTimePoint;
}

function renderCharacters() {
  const participant = getActiveParticipant();
  const list = byId("character-list");
  const template = byId("character-template");
  list.innerHTML = "";

  participant.characters.forEach((character, index) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".character-card");
    card.dataset.characterId = character.id;
    card.querySelector(".card-title").textContent = `他者${String(index + 1).padStart(2, "0")}`;
    card.querySelectorAll("input").forEach((input) => {
      input.value = character[input.dataset.field] || "";
      input.addEventListener("input", (event) => updateCharacter(character.id, input.dataset.field, event.target.value));
    });
    list.appendChild(node);
  });

  byId("add-character").disabled = participant.characters.length >= 3;
}

function renderGenerationControls() {
  const participant = getActiveParticipant();
  const select = byId("character-select");
  select.innerHTML = participant.characters
    .map(
      (character) =>
        `<option value="${character.id}" ${character.id === state.selectedCharacterId ? "selected" : ""}>${
          character.name || "未命名角色"
        }</option>`,
    )
    .join("");

  document.querySelectorAll(".segmented[data-field='condition'] button").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === state.selectedCondition);
  });

  document.querySelectorAll(".segmented[data-field='timePoint'] button").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === state.selectedTimePoint);
  });

  const ready = hasRequiredGenerationData();
  byId("generate-button").disabled = !ready;
}

function renderPostcard() {
  const generation = getCurrentGeneration();
  const character = getSelectedCharacter();
  const conditionLabel = labels[state.selectedCondition];
  const timePointLabel = labels[state.selectedTimePoint];
  byId("postcard-status").textContent = generation ? "已生成" : "示意";
  byId("postcard-title").textContent = generation?.characterName || character?.name || "爸爸（示意）";
  byId("postcard-meta").textContent = `${getEventTypeLabel(getActiveParticipant().eventType)} / ${conditionLabel} / ${timePointLabel}`;
  byId("postcard-body").textContent =
    generation?.generatedContent ||
    "【爸爸】我看到他把杯子握得很緊，明明只是幾句話，他卻像怕自己一開口就會撐不住。當下我沒有馬上問，因為我知道他一被追問，就會把話收回去。";
}

function renderMatrix() {
  const participant = getActiveParticipant();
  byId("progress-matrix").innerHTML = participant.characters
    .map((character) => {
      const cells = conditions
        .flatMap((condition) =>
          timePoints.map((timePoint) => {
            const generation = state.generations.find(
              (item) =>
                item.participantId === participant.id &&
                item.characterId === character.id &&
                item.condition === condition &&
                item.timePointType === timePoint,
            );
            const status = generation ? "generated" : "missing";
            return `<div class="matrix-cell ${status}"><span>${labels[condition]}</span><strong>${recordTimeLabels[timePoint]}</strong></div>`;
          }),
          )
        .join("");
      return `<div class="matrix-row"><div class="matrix-name">${character.name || "未命名角色"}</div>${cells}</div>`;
    })
    .join("");
}

function renderRecords() {
  const activeGenerations = getActiveGenerations();
  byId("record-list").innerHTML =
    activeGenerations.length === 0
      ? `<article class="record-card example">
          <p>示意 / ${getEventTypeLabel(getActiveParticipant().eventType)} / 當下</p>
          <h4>爸爸</h4>
          <p>生成後，每一筆會像這樣列在這裡。正式串接後，這筆資料會同時自動寫入 Notion。</p>
        </article>`
      : activeGenerations
          .map(
            (generation) => `
        <article class="record-card">
          <p>${generation.eventType || getEventTypeLabel(getActiveParticipant().eventType)} / ${labels[generation.condition]} / ${
            labels[generation.timePointType]
          } / ${generation.timePointValue}</p>
          <h4>${generation.characterName}</h4>
          <p>${generation.generatedContent}</p>
        </article>`,
          )
          .join("");
}

function renderGeneratedViews() {
  renderGenerationControls();
  renderPostcard();
  renderMatrix();
  renderRecords();
}

function render() {
  renderNavigation();
  renderStepVisibility();
  renderEventTypes();
  renderForms();
  renderCharacters();
  renderGeneratedViews();
}

function bindStaticEvents() {
  byId("participant-select").addEventListener("change", (event) => setActiveParticipant(event.target.value));
  byId("participant-next").addEventListener("click", () => setStep("event-type"));
  byId("event-type-next").addEventListener("click", () => setStep("event"));
  byId("add-participant").addEventListener("click", () => {
    const participant = createParticipant(state.participants.length + 1);
    state.participants.push(participant);
    state.activeParticipantId = participant.id;
    state.selectedCharacterId = participant.characters[0].id;
    saveState();
    render();
  });
  byId("delete-participant").addEventListener("click", () => {
    if (state.participants.length <= 1) return;
    const participant = getActiveParticipant();
    state.participants = state.participants.filter((item) => item.id !== participant.id);
    state.generations = state.generations.filter((generation) => generation.participantId !== participant.id);
    state.activeParticipantId = state.participants[0].id;
    state.selectedCharacterId = state.participants[0].characters[0]?.id || "";
    saveState();
    render();
  });

  byId("participant-code").addEventListener("input", (event) => updateParticipant("code", event.target.value));
  byId("interview-date").addEventListener("input", (event) => updateParticipant("interviewDate", event.target.value));
  byId("real-event").addEventListener("input", (event) => updateParticipant("realEventDescription", event.target.value));
  byId("counterfactual-event").addEventListener("input", (event) =>
    updateParticipant("counterfactualDescription", event.target.value),
  );
  byId("real-past-time").addEventListener("input", (event) => updateParticipant("realPastTimePoint", event.target.value));
  byId("real-future-time").addEventListener("input", (event) => updateParticipant("realFutureTimePoint", event.target.value));
  byId("counterfactual-past-time").addEventListener("input", (event) =>
    updateParticipant("counterfactualPastTimePoint", event.target.value),
  );
  byId("counterfactual-future-time").addEventListener("input", (event) =>
    updateParticipant("counterfactualFutureTimePoint", event.target.value),
  );

  byId("add-character").addEventListener("click", () => {
    const participant = getActiveParticipant();
    if (participant.characters.length >= 3) return;
    const characters = [...participant.characters, createCharacter(participant.characters.length + 1)];
    state.participants = state.participants.map((item) => (item.id === participant.id ? { ...item, characters } : item));
    saveState();
    render();
  });

  byId("character-select").addEventListener("change", (event) => {
    state.selectedCharacterId = event.target.value;
    saveState();
    renderGeneratedViews();
  });

  document.querySelectorAll(".segmented[data-field='condition'] button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCondition = button.dataset.value;
      saveState();
      renderGeneratedViews();
    });
  });

  document.querySelectorAll(".segmented[data-field='timePoint'] button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTimePoint = button.dataset.value;
      saveState();
      renderGeneratedViews();
    });
  });

  byId("generate-button").addEventListener("click", async () => {
    if (!hasRequiredGenerationData()) return;
    const button = byId("generate-button");
    button.disabled = true;
    button.textContent = "生成中...";
    byId("postcard-status").textContent = "生成中";
    byId("postcard-body").textContent = "正在呼叫 OpenAI，完成後會自動寫入 Notion。";

    try {
      upsertGeneration(await createApiGeneration());
      renderGeneratedViews();
    } catch (error) {
      byId("postcard-status").textContent = "生成失敗";
      byId("postcard-body").textContent = error.message;
      button.disabled = false;
    } finally {
      button.textContent = "生成這一筆";
    }
  });
}

bindAccessGate();
bindStaticEvents();
render();
restoreAccessSession();
window.addEventListener("resize", updateViewportScale);
