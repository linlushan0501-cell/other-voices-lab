const steps = [
  { id: "participant", label: "參與者", title: "參與者資料" },
  { id: "event", label: "事件", title: "事件與時間點" },
  { id: "characters", label: "角色", title: "他者角色" },
  { id: "generate", label: "生成", title: "單筆生成" },
  { id: "review", label: "審閱", title: "審閱內容" },
];

const conditions = ["real", "counterfactual"];
const timePoints = ["past", "present", "future"];
const storageKey = "research-monologue-dashboard-static-v1";

const labels = {
  real: "真實",
  counterfactual: "反事實",
  past: "過去",
  present: "現在",
  future: "未來",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  regenerated: "regenerated",
};

const defaultState = {
  activeStep: "participant",
  selectedCondition: "real",
  selectedTimePoint: "present",
  selectedCharacterId: "character-1",
  reviewFilter: "all",
  participant: {
    id: "participant-local",
    code: "",
    interviewDate: "",
    realEventDescription: "",
    counterfactualDescription: "",
    pastTimePoint: "",
    futureTimePoint: "",
    characters: [
      { id: "character-1", name: "", relationship: "", selectionReason: "" },
      { id: "character-2", name: "", relationship: "", selectionReason: "" },
    ],
  },
  generations: [],
};

let state = loadState();

function loadState() {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? { ...structuredClone(defaultState), ...JSON.parse(value) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function byId(id) {
  return document.getElementById(id);
}

function setStep(stepId) {
  state.activeStep = stepId;
  saveState();
  render();
}

function updateParticipant(field, value) {
  state.participant[field] = value;
  saveState();
  renderGeneratedViewsOnly();
}

function updateCharacter(id, field, value) {
  state.participant.characters = state.participant.characters.map((character) =>
    character.id === id ? { ...character, [field]: value } : character,
  );

  if (!state.participant.characters.some((character) => character.id === state.selectedCharacterId)) {
    state.selectedCharacterId = state.participant.characters[0]?.id || "";
  }

  saveState();
  renderGeneratedViewsOnly();
}

function getSelectedCharacter() {
  return (
    state.participant.characters.find((character) => character.id === state.selectedCharacterId) ||
    state.participant.characters[0]
  );
}

function getTimePointValue(timePoint) {
  if (timePoint === "past") return state.participant.pastTimePoint;
  if (timePoint === "future") return state.participant.futureTimePoint;
  return "此時此刻";
}

function generationId(characterId, condition, timePoint) {
  return `${characterId}-${condition}-${timePoint}`;
}

function getCurrentGeneration() {
  const character = getSelectedCharacter();
  if (!character) return null;
  return state.generations.find(
    (generation) =>
      generation.characterId === character.id &&
      generation.condition === state.selectedCondition &&
      generation.timePointType === state.selectedTimePoint,
  );
}

function hasRequiredGenerationData() {
  const character = getSelectedCharacter();
  return Boolean(
    state.participant.realEventDescription.trim() &&
      state.participant.counterfactualDescription.trim() &&
      state.participant.pastTimePoint.trim() &&
      state.participant.futureTimePoint.trim() &&
      character?.name.trim() &&
      character?.relationship.trim(),
  );
}

function createMockGeneration(reviewerNotes = "") {
  const character = getSelectedCharacter();
  const condition = state.selectedCondition;
  const timePointType = state.selectedTimePoint;
  const eventText =
    condition === "real" ? state.participant.realEventDescription : state.participant.counterfactualDescription;
  const timePointValue = getTimePointValue(timePointType);

  return {
    id: generationId(character.id, condition, timePointType),
    participantId: state.participant.id,
    characterId: character.id,
    characterName: character.name || "未命名角色",
    relationship: character.relationship,
    selectionReason: character.selectionReason,
    condition,
    timePointType,
    timePointValue,
    generatedContent: `【${character.name || "未命名角色"}】我站在${labels[timePointType]}的「${timePointValue}」，以${character.relationship || "他者"}的位置看著這件事。${labels[condition]}情境裡，我知道的只有研究者提供的這些片段：「${eventText.slice(0, 72)}」。我不替參與者補上沒有說出口的背景，也不把自己的想像說成事實。被選進這段敘事，是因為${character.selectionReason || "我和參與者之間有需要被理解的關係"}。`,
    generationTimestamp: new Date().toISOString(),
    promptVersion: "static-prototype-v1",
    reviewStatus: reviewerNotes ? "regenerated" : "pending",
    reviewerNotes,
    approvedAt: null,
  };
}

function upsertGeneration(generation) {
  state.generations = [
    ...state.generations.filter((item) => item.id !== generation.id),
    generation,
  ];
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

  byId("step-flow").innerHTML = steps
    .map(
      (step) =>
        `<button class="${state.activeStep === step.id ? "active" : ""}" data-step="${step.id}" type="button">${step.label}</button>`,
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

function renderForms() {
  byId("participant-code").value = state.participant.code;
  byId("interview-date").value = state.participant.interviewDate;
  byId("real-event").value = state.participant.realEventDescription;
  byId("counterfactual-event").value = state.participant.counterfactualDescription;
  byId("past-time").value = state.participant.pastTimePoint;
  byId("future-time").value = state.participant.futureTimePoint;
}

function renderCharacters() {
  const list = byId("character-list");
  const template = byId("character-template");
  list.innerHTML = "";

  state.participant.characters.forEach((character, index) => {
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

  byId("add-character").disabled = state.participant.characters.length >= 3;
}

function renderGenerationControls() {
  const select = byId("character-select");
  select.innerHTML = state.participant.characters
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
  byId("generate-hint").textContent = ready
    ? "每次只會生成目前選定的角色、條件與時間。"
    : "請先完成事件、時間點，並至少填好角色名稱與關係。";
}

function renderPostcard() {
  const generation = getCurrentGeneration();
  const character = getSelectedCharacter();
  byId("postcard-status").textContent = generation ? generation.reviewStatus : "尚未生成";
  byId("postcard-title").textContent = generation?.characterName || character?.name || "等待選擇";
  byId("postcard-body").textContent =
    generation?.generatedContent || "選定角色、條件與時間點後，按下生成。結果會以明信片形式出現在這裡。";
}

function renderMatrix() {
  byId("progress-matrix").innerHTML = state.participant.characters
    .map((character) => {
      const cells = conditions
        .flatMap((condition) =>
          timePoints.map((timePoint) => {
            const generation = state.generations.find(
              (item) => item.characterId === character.id && item.condition === condition && item.timePointType === timePoint,
            );
            const status = generation?.reviewStatus || "missing";
            return `<div class="matrix-cell ${status}"><span>${labels[condition]}</span><strong>${labels[timePoint]}</strong></div>`;
          }),
        )
        .join("");
      return `<div class="matrix-row"><div class="matrix-name">${character.name || "未命名角色"}</div>${cells}</div>`;
    })
    .join("");
}

function renderReview() {
  document.querySelectorAll("#review-filter button").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === state.reviewFilter);
  });

  const visible =
    state.reviewFilter === "all"
      ? state.generations
      : state.generations.filter((generation) => generation.reviewStatus === state.reviewFilter);

  byId("review-list").innerHTML =
    visible.length === 0
      ? `<p class="empty">目前沒有符合篩選的生成內容。</p>`
      : visible
          .map(
            (generation) => `
        <article class="review-card" data-id="${generation.id}">
          <header>
            <div>
              <p>${labels[generation.condition]} / ${labels[generation.timePointType]} / ${generation.timePointValue}</p>
              <h3>${generation.characterName}</h3>
            </div>
            <span class="badge">${generation.reviewStatus}</span>
          </header>
          <textarea data-action="content">${generation.generatedContent}</textarea>
          <input data-action="notes" value="${generation.reviewerNotes || ""}" placeholder="退回或重生原因" />
          <div class="button-row">
            <button class="primary-button" data-action="approve" type="button">核可</button>
            <button class="secondary-button" data-action="reject" type="button">標記問題</button>
            <button class="secondary-button" data-action="regenerate" type="button">退回重生</button>
          </div>
        </article>`,
          )
          .join("");
}

function renderGeneratedViewsOnly() {
  renderGenerationControls();
  renderPostcard();
  renderMatrix();
  renderReview();
}

function render() {
  renderNavigation();
  renderStepVisibility();
  renderForms();
  renderCharacters();
  renderGeneratedViewsOnly();
}

function bindStaticEvents() {
  byId("participant-code").addEventListener("input", (event) => updateParticipant("code", event.target.value));
  byId("interview-date").addEventListener("input", (event) => updateParticipant("interviewDate", event.target.value));
  byId("real-event").addEventListener("input", (event) => updateParticipant("realEventDescription", event.target.value));
  byId("counterfactual-event").addEventListener("input", (event) =>
    updateParticipant("counterfactualDescription", event.target.value),
  );
  byId("past-time").addEventListener("input", (event) => updateParticipant("pastTimePoint", event.target.value));
  byId("future-time").addEventListener("input", (event) => updateParticipant("futureTimePoint", event.target.value));

  byId("add-character").addEventListener("click", () => {
    if (state.participant.characters.length >= 3) return;
    const id = `character-${state.participant.characters.length + 1}`;
    state.participant.characters.push({ id, name: "", relationship: "", selectionReason: "" });
    saveState();
    render();
  });

  byId("character-select").addEventListener("change", (event) => {
    state.selectedCharacterId = event.target.value;
    saveState();
    renderGeneratedViewsOnly();
  });

  document.querySelectorAll(".segmented[data-field='condition'] button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCondition = button.dataset.value;
      saveState();
      renderGeneratedViewsOnly();
    });
  });

  document.querySelectorAll(".segmented[data-field='timePoint'] button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTimePoint = button.dataset.value;
      saveState();
      renderGeneratedViewsOnly();
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
      renderGeneratedViewsOnly();
    }, 700);
  });

  byId("review-filter").addEventListener("click", (event) => {
    if (!event.target.matches("button")) return;
    state.reviewFilter = event.target.dataset.status;
    saveState();
    renderReview();
  });

  byId("review-list").addEventListener("input", (event) => {
    const card = event.target.closest(".review-card");
    if (!card) return;
    const generation = state.generations.find((item) => item.id === card.dataset.id);
    if (!generation) return;
    if (event.target.dataset.action === "content") {
      generation.generatedContent = event.target.value;
      saveState();
      renderPostcard();
    }
    if (event.target.dataset.action === "notes") {
      generation.reviewerNotes = event.target.value;
      saveState();
    }
  });

  byId("review-list").addEventListener("click", (event) => {
    if (!event.target.matches("button")) return;
    const card = event.target.closest(".review-card");
    const generation = state.generations.find((item) => item.id === card.dataset.id);
    if (!generation) return;

    if (event.target.dataset.action === "approve") {
      generation.reviewStatus = "approved";
      generation.approvedAt = new Date().toISOString();
    }

    if (event.target.dataset.action === "reject") {
      generation.reviewStatus = "rejected";
    }

    if (event.target.dataset.action === "regenerate") {
      const previousSelection = {
        characterId: state.selectedCharacterId,
        condition: state.selectedCondition,
        timePoint: state.selectedTimePoint,
      };
      state.selectedCharacterId = generation.characterId;
      state.selectedCondition = generation.condition;
      state.selectedTimePoint = generation.timePointType;
      upsertGeneration(createMockGeneration(generation.reviewerNotes || "研究者退回重新生成"));
      state.selectedCharacterId = previousSelection.characterId;
      state.selectedCondition = previousSelection.condition;
      state.selectedTimePoint = previousSelection.timePoint;
    }

    saveState();
    renderGeneratedViewsOnly();
  });

  byId("reset-data").addEventListener("click", () => {
    if (!confirm("確定要清空目前原型資料？")) return;
    state = structuredClone(defaultState);
    saveState();
    render();
  });

  byId("export-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "research-dashboard-export.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}

bindStaticEvents();
render();
