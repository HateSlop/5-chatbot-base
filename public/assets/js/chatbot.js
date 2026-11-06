const shell = document.querySelector(".story-layout");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-message");
const log = document.getElementById("chat-log");
const actionList = document.getElementById("action-list");
const journalList = document.getElementById("journal-list");
const statusMessage = document.getElementById("status-message");
const speakerNames = { jimmy: "지미", karen: "캐런", bob: "밥", cathy: "캐시", narrator: "이야기", thought: "", user: "나" };
const endingNames = { escape: "더뉴빌리지 탈출", death: "벽에 걸린 사진", assimilation: "새로운 이웃" };
const dialogueStage = new DialogueStage(document.getElementById("dialogue-stage"));
const postMoveUI = new PostMoveUI(document.getElementById("dialogue-stage"), form, input, document.getElementById("send-btn"), performAction);
actionList.className = 'action-list scene-actions';
document.querySelector('#dialogue-stage .dialogue-box').append(statusMessage);
document.querySelector('#dialogue-stage .dialogue-controls').append(actionList);
let stateToken = null;
let transcript = [];
let playerName = "";
let selectedCharacter = null;
let currentView = null;
let busy = false;
// Frames only present the festival events already disclosed by the server.
let doorExamined = false;
const doorHotspot = document.createElement('button');
doorHotspot.type = 'button';
doorHotspot.className = 'door-hotspot';
doorHotspot.setAttribute('aria-label', '열린 문 살펴보기');
doorHotspot.hidden = true;
document.getElementById('dialogue-stage').append(doorHotspot);
// Match the clickable doorway to the background's cover crop at any window size.
const shopStage = document.getElementById('dialogue-stage');
function positionDoor() {
  const width = shopStage.clientWidth, height = shopStage.clientHeight;
  const scale = Math.max(width / 1445, height / 1089);
  const left = (width - 1445 * scale) / 2, top = (height - 1089 * scale) / 2;
  doorHotspot.style.left = `${left}px`;
  doorHotspot.style.top = `${top}px`;
  doorHotspot.style.width = `${1445 * scale}px`;
  doorHotspot.style.height = `${1089 * scale}px`;
  const karen = currentView?.scene_id === 'karen_dinner';
  doorHotspot.style.backgroundImage = `url("/assets/images/${karen ? 'karen_house.svg' : 'butcher_shop_open.png'}")`;
  doorHotspot.style.clipPath = karen
    ? 'polygon(7.8% 23.7%, 21.8% 24.4%, 21.8% 65.2%, 8% 66.7%)'
    : 'polygon(2.2% 26%, 6.9% 27.8%, 6.9% 55.9%, 2.4% 58.4%)';
  if (shopStage.style.setProperty) {
    shopStage.style.setProperty('--jimmy-left', `${left - 40 * scale}px`);
    shopStage.style.setProperty('--jimmy-top', `${top + 210 * scale}px`);
    shopStage.style.setProperty('--jimmy-width', `${370 * scale}px`);
    shopStage.style.setProperty('--jimmy-height', `${500 * scale}px`);
  }
}
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(positionDoor).observe(shopStage);
doorHotspot.addEventListener('click', () => {
  if (busy || !['empty_butcher', 'karen_dinner'].includes(currentView?.scene_id)) return;
  doorExamined = true;
  renderView(currentView);
});
let festivalFrame = 0;
let karenDinnerDismissed = false;
let karenDepartureTimer;
const greetingChats = new Map();
function greetingLocked(view) {
  return ['arrival', 'neighbors'].includes(view.scene_id) && view.available_characters.length > 0 &&
    (greetingChats.get(`${view.scene_id}:${view.location_id}`) || 0) < 2;
}
let angryReaction = null;
let reactionTimer;
let reactionRender = 0;
function clearReaction() {
  clearTimeout(reactionTimer);
  angryReaction = null;
  ++reactionRender;
}
// Presentation only: hide completed greeting destinations, without changing server actions.
const greetedPlaces = new Set();
const greetingDestinations = {visit_karen:'karen_house',visit_bob:'butcher_shop',visit_cathy:'salon'};
function focusChatWhenReady() {
  dialogueStage.ready?.then(() => { if (stateToken && !input.disabled) input.focus(); });
}

function speakerName(id) {
  return id === "user" ? playerName : (speakerNames[id] ?? id);
}

function messageElement(item) {
  const element = document.createElement("article");
  element.className = `message ${item.speaker === "user" ? "user" : ["narrator", "thought"].includes(item.speaker) ? "scene-note" : "bot"}`;
  const label = document.createElement("strong");
  label.textContent = speakerName(item.speaker) ? `${speakerName(item.speaker)}: ` : "";
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
  if (!currentView) return;
  const conversation = transcript.filter(item =>
    item.scene_id === currentView.scene_id && item.location_id === currentView.location_id &&
    (item.kind === "scene" || item.kind === "chat" && item.character_id === selectedCharacter));
  log.replaceChildren(...conversation.map(messageElement));
  if (!conversation.length) {
    const empty = document.createElement("p");
    empty.className = "conversation-context";
    empty.textContent = selectedCharacter ? "말을 걸어 보세요." : "지금은 대화할 사람이 없습니다.";
    log.append(empty);
  }
  const line = conversation.findLast(item => item.speaker !== "user");
  dialogueStage.render({
    background: ['butcher_search', 'empty_butcher', 'bob_caught'].includes(currentView.scene_id)
      ? '/assets/images/butcher_shop_open.png' : currentView.background,
    image: currentView.scene_id === "karen_dinner" && selectedCharacter === "karen" ? (karenDinnerDismissed ? null : "/assets/images/karen_smile.png") : (selectedCharacter
      ? conversation.findLast(item => item.speaker === selectedCharacter && item.image)?.image || currentView.available_characters[0]?.portrait
      : line?.image) || null,
    speaker: (currentView.scene_id === "empty_butcher" || currentView.scene_id === "karen_dinner" && karenDinnerDismissed) ? "" : line ? speakerName(line.speaker) : "",
    text: currentView.scene_id === "karen_dinner" && karenDinnerDismissed ? (doorExamined ? "이 방은 뭘까?" : "") : currentView.scene_id === "empty_butcher" ? (doorExamined ? "어? 왜 문이 열려있지?" : "") : line?.text || "",
    visitorId: selectedCharacter,
    sceneId: currentView.scene_id,
  });
  clearTimeout(karenDepartureTimer);
  if (currentView.scene_id === 'karen_dinner' && !karenDinnerDismissed) {
    Promise.resolve(dialogueStage.ready).then(() => {
      const depart = async () => {
        if (currentView?.scene_id !== 'karen_dinner' || karenDinnerDismissed || busy) return;
        if (dialogueStage.pages && dialogueStage.pageIndex < dialogueStage.pages.length - 1) {
          karenDepartureTimer = setTimeout(depart, 1000);
          return;
        }
        await dialogueStage.depart?.(false);
        if (currentView?.scene_id !== 'karen_dinner') return;
        karenDinnerDismissed = true;
        renderView(currentView);
      };
      karenDepartureTimer = setTimeout(depart, 4500);
    });
  }
  clearTimeout(reactionTimer);
  const render = ++reactionRender;
  if (angryReaction) {
    Promise.resolve(dialogueStage.ready).then(ready => {
      if (ready === false || render !== reactionRender || !angryReaction) return;
      reactionTimer = setTimeout(() => {
        if (render !== reactionRender) return;
        angryReaction = null;
        renderMessages();
      }, 1500);
    });
  }
  log.scrollTop = log.scrollHeight;
}

function renderView(view) {
  if (currentView?.scene_id !== view.scene_id) doorExamined = false;
  currentView = view;
  const emptyShop = view.scene_id === 'empty_butcher' || view.scene_id === 'karen_dinner' && karenDinnerDismissed;
  shopStage.setAttribute('data-scene', view.scene_id);
  document.getElementById('dialogue-stage').setAttribute('data-empty-shop', String(emptyShop && !doorExamined));
  doorHotspot.hidden = !emptyShop || doorExamined || !view.available_actions.some(a => ['inspect_basement', 'inspect_room'].includes(a.id));
  doorHotspot.disabled = busy;
  doorHotspot.setAttribute('aria-label', view.scene_id === 'karen_dinner' ? '방 문 살펴보기' : '열린 문 살펴보기');
  if (emptyShop || view.scene_id === 'butcher_search') positionDoor();
  const place = view.location_name || view.location_id;
  document.getElementById("location-title").textContent = place;
  const background = document.getElementById("scene-background");
  background.style.backgroundImage = view.background ? `url("${view.background}")` : "none";
  background.setAttribute("aria-label", `${place} 배경`);
  document.getElementById("affinity-value").textContent = `${view.affinity} / 100`;

  actionList.replaceChildren();
  const festival = ['festival', 'hair_found'].includes(view.scene_id);
  const showingDiscovery = view.scene_id === 'hair_found' && festivalFrame < 2;
  const karenGreeting = view.scene_id === 'karen_dinner' && !karenDinnerDismissed;
  postMoveUI.setSplit?.(!festival);
  if (showingDiscovery) {
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'action-button';
    next.textContent = '다음 장면 ›';
    next.disabled = busy;
    next.addEventListener('click', () => {
      if (busy) return;
      ++festivalFrame;
      renderView(currentView);
    });
    actionList.append(next);
  }
  if (view.scene_id === 'neighbors' && Object.values(greetingDestinations).includes(view.location_id)) {
    greetedPlaces.add(view.location_id);
  }
  for (const action of view.available_actions) {
    if (showingDiscovery || karenGreeting || emptyShop && !doorExamined || greetingLocked(view) && action.kind === 'move') continue;
    if (view.scene_id === 'neighbors' && action.kind === 'move' && greetedPlaces.has(greetingDestinations[action.id])) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-button ${action.kind}`;
    button.textContent = emptyShop && action.id === 'inspect_basement' ? '지하실에 내려가본다' : emptyShop && action.id === 'inspect_room' ? '방에 들어가본다' : action.label;
    button.disabled = busy;
    button.addEventListener("click", () => performAction(action.id));
    actionList.append(button);
  }

  const character = view.available_characters[0];
  selectedCharacter = character?.id || null;
  if (character) speakerNames[character.id] = character.name;
  document.getElementById("scene-character").textContent = character ? `현재 대화 상대: ${character.name}` : "지금 이곳에는 대화 상대가 없습니다";
  document.getElementById("character-title").textContent = character?.name || "대화 상대 없음";
  const portrait = document.getElementById("character-portrait");
  portrait.hidden = !character?.portrait;
  if (character?.portrait) {
    const latestImage = transcript.findLast(item => item.speaker === character.id && item.image &&
      item.scene_id === view.scene_id && item.location_id === view.location_id)?.image;
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
  input.disabled = busy || !character || !!view.ending || festival ||
    view.scene_id === 'karen_dinner' && karenDinnerDismissed;
  document.getElementById("send-btn").disabled = input.disabled;
  input.placeholder = view.ending ? "이야기가 끝났습니다" : character ? `${character.name}에게 말을 걸어 보세요` : "먼저 장소를 선택하세요";
  postMoveUI.render({locationId: view.location_id, locationName: place, registeredName: playerName,
    affinity: view.affinity, actions: greetingLocked(view) ? [] : view.available_actions, busy});
  renderMessages();
}

function applyResponse(data, kind, characterId = null) {
  const changedScene = currentView?.scene_id !== data.view.scene_id || currentView?.location_id !== data.view.location_id;
  const decreased = kind === 'chat' && !changedScene && data.view.affinity < currentView.affinity;
  if (kind === 'chat' && !changedScene) {
    const key = `${data.view.scene_id}:${data.view.location_id}`;
    greetingChats.set(key, (greetingChats.get(key) || 0) + 1);
  }
  clearReaction();
  if (decreased) angryReaction = characterId;
  if (changedScene) {
    festivalFrame = 0;
    karenDinnerDismissed = false;
  }
  stateToken = data.state_token;
  for (const item of data.events) {
    saveMessage({speaker: item.speaker_id, text: item.text, image: item.image, kind,
      character_id: characterId, scene_id: data.view.scene_id, location_id: data.view.location_id});
  }
  renderView(data.view);
}

window.startStory = (data, name) => {
  const continuingVisit = window.entryVisitReady && data.view.location_id === 'player_house' &&
    data.view.available_characters.some(character => character.id === 'jimmy');
  if (continuingVisit) {
    dialogueStage.homeVisitor = 'jimmy';
    dialogueStage.visitorVisible = true;
    dialogueStage.root?.setAttribute('data-continuing', 'true');
  }
  window.entryVisitReady = false;
  playerName = name;
  festivalFrame = 0;
  karenDinnerDismissed = false;
  clearReaction();
  transcript = [];
  greetedPlaces.clear();
  greetingChats.clear();
  clearTimeout(karenDepartureTimer);
  doorExamined = false;
  applyResponse(data, "scene");
  const reveal = () => {
    document.getElementById("name-screen").hidden = true;
    document.getElementById("game-screen").hidden = false;
    document.getElementById("entry-name-dialog")?.close();
  };
  if (continuingVisit && dialogueStage.ready) dialogueStage.ready.then(reveal);
  else reveal();
  if (selectedCharacter) focusChatWhenReady();
};

async function request(path, payload) {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "요청을 처리하지 못했습니다.");
  if (path === '/api/action' && payload.action_id === 'approach_jimmy' && currentView?.scene_id === 'butcher_search') {
    await dialogueStage.depart?.(true);
  }
  applyResponse(data, path === "/api/chat" ? "chat" : "scene", payload.character_id);
}

async function performAction(actionId) {
  if (busy || !stateToken) return;
  if (greetingLocked(currentView) && currentView.available_actions.some(a => a.id === actionId && a.kind === 'move')) return;
  if (currentView.scene_id === 'hair_found' && festivalFrame < 2) return;
  busy = true;
  renderView(currentView);
  statusMessage.textContent = "이야기가 이어지는 중…";
  try {
    await request("/api/action", {state_token: stateToken, action_id: actionId});
    statusMessage.textContent = "";
  } catch (error) { statusMessage.textContent = error.message; }
  finally { busy = false; renderView(currentView); }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || busy || input.disabled || !selectedCharacter || !stateToken) return;
  busy = true;
  renderView(currentView);
  statusMessage.textContent = "답변을 기다리는 중…";
  saveMessage({speaker: "user", text: message, image: null, kind: "chat", character_id: selectedCharacter,
    scene_id: currentView.scene_id, location_id: currentView.location_id});
  renderMessages();
  try {
    await request("/api/chat", {state_token: stateToken, character_id: selectedCharacter, message});
    input.value = "";
    statusMessage.textContent = "답변이 도착했습니다.";
  } catch (error) {
    transcript.pop();
    renderMessages();
    statusMessage.textContent = error.message;
  } finally {
    busy = false;
    renderView(currentView);
    if (!input.disabled) focusChatWhenReady();
  }
});

window.addEventListener("pagehide", () => {
  clearReaction();
  greetedPlaces.clear();
  greetingChats.clear();
  clearTimeout(karenDepartureTimer);
  doorExamined = false;
  stateToken = null;
  transcript = [];
});
for (const id of ['restart-btn', 'ending-restart']) {
  document.getElementById(id).addEventListener('click', () => { if (!busy) window.location.reload(); });
}
window.addEventListener("pageshow", event => {
  document.getElementById("username").value = "";
  if (event.persisted) window.location.reload();
});
