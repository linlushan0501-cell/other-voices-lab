const steps = [
  { id: "participant", label: "參與者", title: "參與者資料" },
  { id: "event", label: "事件", title: "事件與時間點" },
  { id: "characters", label: "角色", title: "他者角色" },
  { id: "generate", label: "生成", title: "單筆生成" },
];

const conditions = ["real", "counterfactual"];
const timePoints = ["past", "present", "future"];
const storageKey = "research-monologue-dashboard-static-v1";

const labels = {
  real: "真實",
  counterfactual: "反事實",
  past: "過去",
  present: "當下",
  future: "未來",
};

function createCharacter(index) {
  return { id: `character-${index}`, name: "", relationship: "", selectionReason: "" };
}

function createParticipant(index) {
  return {
    id: `participant-${Date.now()}-${index}`,
    code: `P-${String(index).padStart(3, "0")}`,
    interviewDate: "",
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
  activeStep: "participant",
  activeParticipantId: firstParticipant.id,
  selectedCondition: "real",
  selectedTimePoint: "present",
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

    const next = {
      ...cloneDefaultState(),
      ...parsed,
      participants,
      activeParticipantId: parsed.activeParticipantId || participants[0].id,
      generations: parsed.generations || [],
    };

    if (!participants.some((participant) => participant.id === next.activeParticipantId)) {
      next.activeParticipantId = participants[0].id;
    }

    if (!steps.some((step) => step.id === next.activeStep)) {
      next.activeStep = "participant";
    }

    if (!getActiveParticipantFromState(next).characters.some((character) => character.id === next.selectedCharacterId)) {
      next.selectedCharacterId = getActiveParticipantFromState(next).characters[0]?.id || "";
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

function setActiveParticipant(participantId) {
  state.activeParticipantId = participantId;
  const participant = getActiveParticipant();
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

  return Boolean(hasScenario && hasTimePoint && character?.name.trim() && character?.relationship.trim());
}

function createMockGeneration() {
  const participant = getActiveParticipant();
  const character = getSelectedCharacter();
  const condition = state.selectedCondition;
  const timePointType = state.selectedTimePoint;
  const eventText = getScenarioDescription(condition);
  const timePointValue = getTimePointValue(condition, timePointType);
  const temporalCue = timePointType === "present" ? "這個當下" : `「${timePointValue}」那個時間點`;

  return {
    id: generationId(participant.id, character.id, condition, timePointType),
    participantId: participant.id,
    participantCode: participant.code,
    characterId: character.id,
    characterName: character.name || "未命名角色",
    relationship: character.relationship,
    selectionReason: character.selectionReason,
    condition,
    timePointType,
    timePointValue,
    generatedContent: `【${character.name || "未命名角色"}】聽到這段${labels[condition]}，我在${temporalCue}最先想到的，是他那時候其實需要有人停下來聽他說完。「${eventText.slice(0, 72)}」這些片段已經夠重了，我不想替他補上沒有說出口的背景，只想從我和他的關係裡，把我能理解的部分說清楚。`,
    generationTimestamp: new Date().toISOString(),
    promptVersion: "static-prototype-v3",
  };
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

function renderStepVisibility() {
  const current = steps.find((step) => step.id === state.activeStep);
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
    card.querySelector(".card-title").textContent = `角色 ${index + 1}`;
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
  byId("postcard-status").textContent = generation ? "已生成" : "示意";
  byId("postcard-title").textContent = generation?.characterName || character?.name || "爸爸（示意）";
  byId("postcard-body").textContent =
    generation?.generatedContent ||
    "【爸爸】聽完這段敘述，我第一個反應是想先確認孩子有沒有被好好理解。這裡會顯示生成後的完整獨白；串接 API 後，生成完成會直接自動寫入 Notion。";
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
            return `<div class="matrix-cell ${status}"><span>${labels[condition]}</span><strong>${labels[timePoint]}</strong></div>`;
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
          <p>示意 / 關鍵事件 / 當下</p>
          <h4>爸爸</h4>
          <p>生成後，每一筆會像這樣列在這裡。正式串接後，這筆資料會同時自動寫入 Notion。</p>
        </article>`
      : activeGenerations
          .map(
            (generation) => `
        <article class="record-card">
          <p>${labels[generation.condition]} / ${labels[generation.timePointType]} / ${generation.timePointValue}</p>
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
  renderForms();
  renderCharacters();
  renderGeneratedViews();
}

function bindStaticEvents() {
  byId("participant-select").addEventListener("change", (event) => setActiveParticipant(event.target.value));
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

  byId("generate-button").addEventListener("click", () => {
    if (!hasRequiredGenerationData()) return;
    const button = byId("generate-button");
    button.disabled = true;
    button.textContent = "生成中...";
    setTimeout(() => {
      upsertGeneration(createMockGeneration());
      button.textContent = "生成這一筆";
      renderGeneratedViews();
    }, 650);
  });
}

bindStaticEvents();
render();
