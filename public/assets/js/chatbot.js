const shell = document.querySelector(".story-layout");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-message");
const log = document.getElementById("chat-log");
const actionList = document.getElementById("action-list");
const journalList = document.getElementById("journal-list");
const statusMessage = document.getElementById("status-message");
const speakerNames = { jimmy: "지미", karen: "캐런", bob: "밥", cathy: "캐시", narrator: "이야기", thought: "나의 생각", user: "나" };
const endingNames = { escape: "더뉴빌리지 탈출", death: "벽에 걸린 사진", assimilation: "새로운 이웃" };
const entryKey = "new-village-entry";
const canStart = sessionStorage.getItem(entryKey) === "1";
sessionStorage.removeItem(entryKey);
localStorage.removeItem("new-village-state-v1");
localStorage.removeItem("new-village-transcript-v1");
let stateToken = null;
let transcript = [];
let selectedCharacter = null;
let currentView = null;
let busy = false;

function messageElement(item) {
  const element = document.createElement("article");
  element.className = `message ${item.speaker === "user" ? "user" : ["narrator", "thought"].includes(item.speaker) ? "scene-note" : "bot"}`;
  const label = document.createElement("strong");
  label.textContent = speakerNames[item.speaker] || item.speaker;
  element.append(label);
  const body = document.createElement("p");
  body.textContent = item.text;
  element.append(body);
  return element;
}

function saveMessage(item) {
  transcript.push(item);
  transcript = transcript.slice(-120);
}

function renderMessages() {
  if (!currentView) {
    log.replaceChildren(...transcript.slice(-12).map(messageElement));
    return;
  }
  const previousScene = transcript.findLastIndex((item) => item.kind !== "chat" && item.scene_id &&
    (item.scene_id !== currentView.scene_id || item.location_id !== currentView.location_id));
  const conversation = transcript.filter((item, index) =>
    (item.kind === "chat" && item.character_id === selectedCharacter && selectedCharacter) ||
    (item.kind !== "chat" && index > previousScene));
  log.replaceChildren(...conversation.map(messageElement));
  if (!conversation.length) {
    const empty = document.createElement("p");
    empty.className = "conversation-context";
    empty.textContent = selectedCharacter ? "말을 걸어 보세요." : "지금은 대화할 사람이 없습니다.";
    log.append(empty);
  }
  log.scrollTop = log.scrollHeight;
}

function renderView(view) {
  currentView = view;
  const place = view.location_name || view.location_id;
  document.getElementById("location-title").textContent = place;
  const background = document.getElementById("scene-background");
  background.style.backgroundImage = view.background ? `url("${view.background}")` : "none";
  background.setAttribute("aria-label", `${place} 배경`);
  document.getElementById("affinity-value").textContent = `${view.affinity} / 100`;

  actionList.replaceChildren();
  for (const action of view.available_actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-button ${action.kind}`;
    button.textContent = action.label;
    button.disabled = busy;
    button.addEventListener("click", () => performAction(action.id));
    actionList.append(button);
  }

  const character = view.available_characters[0];
  selectedCharacter = character?.id || null;
  document.getElementById("scene-character").textContent = character ? `현재 대화 상대: ${character.name}` : "지금 이곳에는 대화 상대가 없습니다";
  document.getElementById("character-title").textContent = character?.name || "대화 상대 없음";
  const portrait = document.getElementById("character-portrait");
  portrait.hidden = !character?.portrait;
  if (character?.portrait) {
    const latestImage = transcript.findLast((item) => item.speaker === character.id && item.image)?.image;
    portrait.src = latestImage || character.portrait;
    portrait.alt = `${character.name}의 현재 모습`;
  }

  journalList.replaceChildren();
  for (const note of view.journal) {
    const item = document.createElement("li");
    item.textContent = note;
    journalList.append(item);
  }
  const endingCard = document.getElementById("ending-card");
  endingCard.hidden = !view.ending;
  endingCard.textContent = view.ending ? `ENDING — ${endingNames[view.ending] || view.ending}` : "";
  document.getElementById("ending-restart").hidden = !view.ending;
  input.disabled = busy || !character || !!view.ending;
  document.getElementById("send-btn").disabled = input.disabled;
  input.placeholder = view.ending ? "이야기가 끝났습니다" : character ? `${character.name}에게 말을 걸어 보세요` : "먼저 장소를 선택하세요";
  renderMessages();
}

function applyResponse(data, kind, characterId = null) {
  stateToken = data.state_token;
  for (const item of data.events) {
    saveMessage({ speaker: item.speaker_id, text: item.text, image: item.image, kind,
      character_id: characterId, scene_id: data.view.scene_id, location_id: data.view.location_id });
  }
  renderView(data.view);
}

async function request(path, payload) {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "요청을 처리하지 못했습니다.");
    error.code = data.error?.code;
    throw error;
  }
  applyResponse(data, path === "/api/chat" ? "chat" : "scene", payload.character_id);
}

async function performAction(actionId) {
  if (busy) return;
  busy = true;
  renderView(currentView);
  statusMessage.textContent = "이야기가 이어지는 중…";
  try {
    await request("/api/action", { state_token: stateToken, action_id: actionId });
    statusMessage.textContent = "이야기가 이어졌습니다.";
  } catch (error) { statusMessage.textContent = error.message; }
  finally {
    busy = false;
    if (currentView) renderView(currentView);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || busy || !selectedCharacter || !stateToken) return;
  busy = true;
  renderView(currentView);
  statusMessage.textContent = "답변을 기다리는 중…";
  saveMessage({ speaker: "user", text: message, image: null, kind: "chat", character_id: selectedCharacter });
  renderMessages();
  try {
    await request("/api/chat", { state_token: stateToken, character_id: selectedCharacter, message });
    input.value = "";
    statusMessage.textContent = "답변이 도착했습니다.";
  } catch (error) {
    transcript.pop();
    renderMessages();
    statusMessage.textContent = error.message;
  } finally {
    busy = false;
    if (currentView) renderView(currentView);
    input.focus();
  }
});

async function initialize() {
  statusMessage.textContent = "이야기를 불러오는 중…";
  try {
    await request("/api/session", { player_name: shell.dataset.playerName || "새 이웃" });
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.replace(document.getElementById("restart-btn").href);
});
if (canStart) initialize();
else location.replace(document.getElementById("restart-btn").href);
