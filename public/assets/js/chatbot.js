const shell = document.querySelector(".story-layout");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-message");
const log = document.getElementById("chat-log");
const actionList = document.getElementById("action-list");
const characterList = document.getElementById("character-list");
const journalList = document.getElementById("journal-list");
const statusMessage = document.getElementById("status-message");
const tokenKey = "new-village-state-v1";
const transcriptKey = "new-village-transcript-v1";
const locationNames = {
  player_house: "새집", karen_house: "캐런의 집", butcher_shop: "정육점",
  salon: "미용실", square: "마을 광장", basement: "정육점 지하실",
};
const endingNames = { escape: "더뉴빌리지 탈출", death: "벽에 걸린 사진", assimilation: "새로운 이웃" };
let stateToken = localStorage.getItem(tokenKey);
let transcript;
try { transcript = JSON.parse(localStorage.getItem(transcriptKey) || "[]"); }
catch { transcript = []; }
let selectedCharacter = null;
let currentView = null;
let busy = false;

const dialogueStage = new DialogueStage(document.getElementById("dialogue-stage"));
const postMoveUI = new PostMoveUI(document.getElementById('dialogue-stage'), form, input, document.getElementById('send-btn'), performAction);
const characterNames = { jimmy: "지미", karen: "캐런", bob: "밥", cathy: "캐시" };
const playerNameKey = "new-village-player-name-v1";
const suppliedName = new URLSearchParams(window.location.search).get("username");
const playerName = suppliedName || localStorage.getItem(playerNameKey) || shell.dataset.playerName;
if (suppliedName) localStorage.setItem(playerNameKey, suppliedName);
shell.dataset.playerName = playerName;
let latestLine = null;
function speakerName(id) {
  if (id === "thought") return '';
  return id === "user" ? playerName : characterNames[id] || (id === "narrator" ? "이야기" : id);
}
function updateDialogueStage() {
  const line = latestLine;
  const character = currentView?.available_characters.find(c => c.id === line?.speaker);
  dialogueStage.render({
    background: currentView?.background,
    image: line && characterNames[line.speaker] ? line.image || character?.portrait : null,
    speaker: line ? speakerName(line.speaker) : "",
    text: line?.text || "",
  });
}

function showMessage(speaker, text, image = null, save = true) {
  const item = document.createElement("article");
  item.className = `message ${speaker === "user" ? "user" : "bot"}`;
  const label = document.createElement("strong");
  label.textContent = speakerName(speaker) ? `${speakerName(speaker)}: ` : '';
  item.append(label);
  if (image) {
    const picture = document.createElement("img");
    picture.onerror = () => { picture.hidden = true; };
    picture.src = image;
    picture.alt = `${label.textContent}의 현재 모습`;
    item.append(picture);
  }
  const body = document.createElement("p");
  body.textContent = text;
  item.append(body);
  log.append(item);
  log.scrollTop = log.scrollHeight;
  if (save) {
    transcript.push({ speaker, text, image });
    transcript = transcript.slice(-120);
    localStorage.setItem(transcriptKey, JSON.stringify(transcript));
  }
  latestLine = { speaker, text, image };
  updateDialogueStage();
  return item;
}

function renderView(view) {
  currentView = view;
  for (const character of view.available_characters) characterNames[character.id] = character.name;
  updateDialogueStage();
  document.getElementById("location-title").textContent = locationNames[view.location_id] || view.location_id;
  const background = document.getElementById("scene-background");
  background.style.backgroundImage = view.background ? `url("${view.background}")` : "none";
  background.setAttribute("aria-label", `${locationNames[view.location_id] || view.location_id} 배경`);

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

  if (!view.available_characters.some((item) => item.id === selectedCharacter)) {
    selectedCharacter = view.available_characters[0]?.id || null;
  }
  characterList.replaceChildren();
  for (const character of view.available_characters) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `character-button ${character.id === selectedCharacter ? "active" : ""}`;
    button.textContent = character.name;
    button.disabled = busy;
    button.setAttribute("aria-pressed", character.id === selectedCharacter ? "true" : "false");
    button.addEventListener("click", () => { selectedCharacter = character.id; renderView(currentView); });
    characterList.append(button);
  }
  const selected = view.available_characters.find((item) => item.id === selectedCharacter);
  document.getElementById("character-title").textContent = selected?.name || "이웃을 선택하세요";
  const portrait = document.getElementById("character-portrait");
  portrait.onerror = () => { portrait.hidden = true; };
  portrait.hidden = !selected?.portrait;
  if (selected?.portrait) { portrait.src = selected.portrait; portrait.alt = `${selected.name} 초상`; }

  journalList.replaceChildren();
  for (const note of view.journal) {
    const item = document.createElement("li");
    item.textContent = note;
    journalList.append(item);
  }
  const endingCard = document.getElementById("ending-card");
  endingCard.hidden = !view.ending;
  endingCard.textContent = view.ending ? `ENDING — ${endingNames[view.ending] || view.ending}` : "";
  input.disabled = busy || !selected || !!view.ending;
  document.getElementById("send-btn").disabled = input.disabled;
  input.placeholder = view.ending ? "이야기가 끝났습니다" : selected ? `${selected.name}에게 말을 걸어 보세요` : "먼저 장소를 선택하세요";
  // No public registered-name or affinity field exists in API v2 yet.
  postMoveUI.render({locationId: view.location_id, locationName: locationNames[view.location_id] || view.location_id, actions: view.available_actions, busy});
}

async function request(path, payload, resetTranscript = false) {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "요청을 처리하지 못했습니다.");
    error.code = data.error?.code;
    throw error;
  }
  if (resetTranscript) {
    transcript = [];
    log.replaceChildren();
    localStorage.removeItem(transcriptKey);
  }
  stateToken = data.state_token;
  localStorage.setItem(tokenKey, stateToken);
  for (const item of data.events) showMessage(item.speaker_id, item.text, item.image);
  renderView(data.view);
}

async function performAction(actionId) {
  if (busy) return;
  busy = true;
  renderView(currentView);
  statusMessage.textContent = "이야기가 이어지는 중…";
  try { await request("/api/action", { state_token: stateToken, action_id: actionId }); }
  catch (error) { statusMessage.textContent = error.message; }
  finally {
    busy = false;
    if (currentView) renderView(currentView);
    if (statusMessage.textContent === "이야기가 이어지는 중…") statusMessage.textContent = "";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || busy || !selectedCharacter || !stateToken) return;
  busy = true;
  renderView(currentView);
  statusMessage.textContent = "답변을 기다리는 중…";
  const userItem = showMessage("user", message);
  try {
    await request("/api/chat", { state_token: stateToken, character_id: selectedCharacter, message });
    input.value = "";
    statusMessage.textContent = "";
  } catch (error) {
    userItem.remove();
    transcript.pop();
    latestLine = transcript.at(-1) || null;
    localStorage.setItem(transcriptKey, JSON.stringify(transcript));
    statusMessage.textContent = error.message;
  } finally {
    busy = false;
    if (currentView) renderView(currentView);
    input.focus();
  }
});

document.getElementById("restart-btn").addEventListener("click", () => {
  if (!busy) window.location.assign("/detail");
});

async function initialize() {
  if (!stateToken) {
    window.location.assign("/detail");
    return;
  }
  busy = true;
  try {
    for (const item of transcript) showMessage(item.speaker, item.text, item.image, false);
    await request("/api/session/resume", { state_token: stateToken });
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent = error.message;
  } finally {
    busy = false;
    if (currentView) renderView(currentView);
  }
}

initialize();
