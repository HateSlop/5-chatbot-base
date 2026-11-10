// 서버 장면과 대화 응답을 받아 현재 화면과 입력 상태를 갱신한다.
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
const festivalChoice = window.FestivalChoice ? new window.FestivalChoice(document.getElementById('festival-choice-dialog'), performAction) : null;
const walletInspection = window.WalletInspection ? new window.WalletInspection(document.getElementById('wallet-dialog'), performAction) : null;
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
const photoHotspot = document.createElement('button');
photoHotspot.type = 'button';
photoHotspot.className = 'door-hotspot photo-hotspot';
photoHotspot.setAttribute('aria-label', '지미 액자 살펴보기');
photoHotspot.hidden = true;
document.getElementById('dialogue-stage').append(photoHotspot);
const photoDialog = document.getElementById('photo-dialog');
const photoFlip = document.getElementById('photo-flip');
const basketDialog = document.getElementById('cathy-basket-dialog');
const basketImage = document.getElementById('cathy-basket-image');
const basketRequest = document.getElementById('cathy-basket-request');
const basketCountdownDisplay = document.getElementById('cathy-basket-countdown');
const basketStatus = document.getElementById('cathy-basket-status');
const basketHotspot = document.createElement('button');
basketHotspot.type = 'button';
basketHotspot.className = 'cathy-basket-hotspot';
basketHotspot.setAttribute('aria-label', '미용실 바구니 열기');
basketHotspot.textContent = '';
basketHotspot.hidden = true;
document.getElementById('dialogue-stage').append(basketHotspot);
let basketStarted = false;
let basketReady = false;
let basketTimer;
let basketCountdown = 3;
let basketGreetingDone = false;
let basketGreetingPending = false;
let basketGreetingTimer;
let basketVisit = 0;
const cathySelected = new Set();
function renderBasket() {
  if (!basketDialog) return;
  basketRequest.hidden = !basketStarted || basketReady;
  if (basketCountdownDisplay) {
    basketCountdownDisplay.hidden = !basketStarted || basketReady;
    if (basketCountdownDisplay.textContent !== String(basketCountdown)) {
      basketCountdownDisplay.textContent = String(basketCountdown);
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        basketCountdownDisplay.animate?.([{opacity:.5,transform:'translateX(-50%) translateY(3px)'},{opacity:1,transform:'translateX(-50%) translateY(0)'}], {duration:150,easing:'ease-out'});
      }
    }
  }
  document.getElementById('cathy-tool-list').hidden = !basketReady;
  document.getElementById('cathy-basket-hint').hidden = !basketStarted;
  const selectedLabels = currentView?.available_actions
    .filter(action => cathySelected.has(action.id.replace('choose_', '')))
    .map(action => action.label.replace(/ 선택$/, '')) || [];
  document.getElementById('cathy-basket-hint').textContent = '캐시가 말한 도구를 기억하고 찾아보세요.' +
    (selectedLabels.length ? ` 선택한 도구: ${selectedLabels.join(', ')} · 다시 누르면 선택 취소` : '');
  document.getElementById('cathy-deliver').hidden = !basketReady;
  document.getElementById('cathy-deliver').disabled = busy;
  for (const button of document.querySelectorAll('#cathy-tool-list button')) {
    button.setAttribute('aria-pressed', String(cathySelected.has(button.dataset.tool)));
    button.disabled = busy || !currentView?.available_actions.some(action => action.id === `choose_${button.dataset.tool}`);
  }
}
basketHotspot.addEventListener('click', () => {
  if (!basketDialog || busy || !basketGreetingDone || currentView?.scene_id !== 'cathy_help') return;
  if (!basketStarted) {
    basketStarted = true;
    basketRequest.textContent = transcript.findLast(item => item.scene_id === 'cathy_help' && item.speaker === 'cathy')?.text || '';
    renderBasket();
    Promise.resolve(basketImage.decode?.().catch(() => {})).then(() => {
      if (currentView?.scene_id !== 'cathy_help') return;
      const started = Date.now();
      const step = 3000 / 3;
      const tick = () => {
        if (currentView?.scene_id !== 'cathy_help') return;
        if (--basketCountdown === 0) basketReady = true;
        renderBasket();
        if (!basketReady) basketTimer = setTimeout(tick, Math.max(0, (4 - basketCountdown) * step - (Date.now() - started)));
      };
      basketTimer = setTimeout(tick, step);
    });
  }
  basketDialog.showModal();
});
document.getElementById('cathy-basket-close')?.addEventListener('click', () => basketDialog.close());
for (const button of document.querySelectorAll('#cathy-tool-list button')) {
  button.addEventListener('click', async () => {
    const tool = button.dataset.tool;
    if (await performAction(`choose_${tool}`)) {
      if (cathySelected.has(tool)) cathySelected.delete(tool);
      else cathySelected.add(tool);
    }
    renderBasket();
  });
}
document.getElementById('cathy-deliver')?.addEventListener('click', () => performAction('help_cathy'));
let photoBack = false;
let selectedPhoto = 'jimmy';
let charlesPhotoDate = '';
let photoOpenVersion = 0;
let photoThoughtTimer;
function clearPhotoThought() {
  clearTimeout(photoThoughtTimer);
  document.getElementById('photo-thought').textContent = '';
}
function showPhotoSide(back) {
  photoBack = back;
  const charles = selectedPhoto === 'charles';
  photoDialog.setAttribute('data-photo', selectedPhoto);
  photoDialog.setAttribute('aria-label', charles ? '찰스 액자 살펴보기' : '지미 액자 살펴보기');
  const front = document.querySelector('.photo-front');
  const reverse = document.querySelector('.photo-back');
  front.src = `/assets/images/${charles ? 'props_charles_front' : 'props_photo_front'}.png`;
  reverse.src = `/assets/images/${charles ? 'props_charles_back' : 'props_photo_back'}.png`;
  front.alt = charles ? '찰스의 사진 액자' : '안경을 쓴 지미의 사진 액자';
  reverse.alt = charles ? 'Charles라는 이름이 적힌 액자 뒷면' : 'Jimmy라는 이름이 적힌 액자 뒷면';
  photoFlip.setAttribute('data-back', String(back));
  photoFlip.setAttribute('aria-label', back ? '액자 뒤집어 앞면 보기' : '액자 뒤집어 뒷면 보기');
  document.querySelector('.photo-front').setAttribute('aria-hidden', String(back));
  document.querySelector('.photo-back').setAttribute('aria-hidden', String(!back));
  document.getElementById('photo-back-date').textContent = back && !charles ? currentView?.photo_back_date || '' : '';
  document.getElementById('photo-hint').textContent = back ? '사진을 누르면 앞면으로 돌아갑니다.' : '사진을 누르면 뒷면을 볼 수 있습니다.';
}
async function openRoomPhoto(person) {
  if (busy || currentView?.scene_id !== 'photo_found' || secretFrame < 0 || secretFrame === 2) return;
  if (person === 'charles' && !await performAction('inspect_charles_photo')) return;
  if (currentView?.scene_id !== 'photo_found') return;
  const opening = ++photoOpenVersion;
  const scene = currentView;
  selectedPhoto = person;
  clearPhotoThought();
  secretFrame = 1;
  renderView(currentView);
  // Keep the previous frame hidden until its replacement is decoded and its flip is reset.
  photoDialog.setAttribute('data-opening', 'true');
  showPhotoSide(false);
  photoDialog.showModal();
  await Promise.all(['.photo-front', '.photo-back'].map(selector => document.querySelector(selector).decode?.().catch(() => {})));
  if (opening !== photoOpenVersion || !photoDialog.open || currentView !== scene) return;
  void document.querySelector('.photo-card').offsetWidth;
  photoDialog.setAttribute('data-opening', 'false');
  if (person === 'charles') {
    const text = transcript.findLast(item => item.scene_id === 'photo_found' && item.speaker === 'thought')?.text || '';
    let length = 0;
    const type = () => {
      document.getElementById('photo-thought').textContent = text.slice(0, ++length);
      if (length < text.length) photoThoughtTimer = setTimeout(type, 40);
    };
    type();
  }
}
photoHotspot.addEventListener('click', () => openRoomPhoto('jimmy'));
photoFlip.addEventListener('click', async () => {
  if (busy) return;
  if (photoBack) return showPhotoSide(false);
  const action = selectedPhoto === 'charles' ? 'inspect_charles_photo_back' : 'inspect_photo_back';
  if (currentView.available_actions.some(a => a.id === action) && !await performAction(action)) {
    document.getElementById('photo-hint').textContent = statusMessage.textContent;
    return;
  }
  if (selectedPhoto === 'charles') {
    const thought = transcript.findLast(item => item.scene_id === 'photo_found' && item.speaker === 'thought')?.text || '';
    charlesPhotoDate = thought.match(/\d{1,2}월\s*\d{1,2}일/)?.[0] || '';
  }
  showPhotoSide(true);
});
async function closePhoto() {
  if (busy || !photoDialog.open) return;
  const action = selectedPhoto === 'charles' ? 'recognize_charles_photo' : 'recognize_photo';
  if (currentView?.scene_id === 'photo_found' && secretFrame < 2 &&
      currentView.available_actions.some(a => a.id === action) && !await performAction(action)) {
    document.getElementById('photo-hint').textContent = statusMessage.textContent;
    return;
  }
  if (photoDialog.open) photoDialog.close();
  clearPhotoThought();
}
document.getElementById('photo-close').addEventListener('click', closePhoto);
photoDialog.addEventListener('cancel', event => { event.preventDefault(); return closePhoto(); });
// Match the clickable doorway to the background's cover crop at any window size.
const shopStage = document.getElementById('dialogue-stage');
const truckEscape = window.TruckEscape ? new window.TruckEscape(shopStage, performAction, dialogueStage) : null;
const exploreHint = document.createElement('p');
exploreHint.className = 'scene-explore-hint';
exploreHint.hidden = true;
shopStage.append(exploreHint);
const meatHotspot = document.createElement('button');
meatHotspot.type = 'button';
meatHotspot.className = 'door-hotspot festival-meat-hotspot';
meatHotspot.setAttribute('aria-label', '접시의 고기 살펴보기');
meatHotspot.hidden = true;
shopStage.append(meatHotspot);
const walletHotspot = document.createElement('button');
walletHotspot.type = 'button';
walletHotspot.className = 'door-hotspot wallet-hotspot';
walletHotspot.setAttribute('aria-label', '옷 주머니의 지갑 살펴보기');
walletHotspot.hidden = true;
shopStage.append(walletHotspot);
const charlesHotspot = document.createElement('button');
charlesHotspot.type = 'button';
charlesHotspot.className = 'door-hotspot photo-hotspot charles-photo-hotspot';
charlesHotspot.setAttribute('aria-label', '옆 액자 살펴보기');
charlesHotspot.hidden = true;
shopStage.append(charlesHotspot);
charlesHotspot.addEventListener('click', () => openRoomPhoto('charles'));
const firelight = document.createElement('div');
firelight.className = 'basement-firelight';
firelight.setAttribute('aria-hidden', 'true');
firelight.hidden = true;
shopStage.append(firelight);
walletHotspot.addEventListener('click', () => {
  if (!busy && currentView?.scene_id === 'basement') walletInspection?.open();
});
meatHotspot.addEventListener('click', async () => {
  if (busy || currentView?.scene_id !== 'hair_found' || festivalFrame !== 0 || shopStage.dataset.dialogueComplete === 'false') return;
  const scene = currentView;
  busy = true;
  meatHotspot.disabled = true;
  try {
    if (currentView !== scene || !stateToken) return;
    festivalFrame = 1;
    renderView(currentView);
    await (dialogueStage.backgroundReady || dialogueStage.ready);
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      shopStage.animate?.([
        {transform:'translate(0, 0)'}, {transform:'translate(-9px, 4px)'},
        {transform:'translate(8px, -4px)'}, {transform:'translate(-7px, 3px)'},
        {transform:'translate(5px, -2px)'}, {transform:'translate(-3px, 1px)'},
        {transform:'translate(0, 0)'},
      ], {duration:620,easing:'ease-out'});
    }
  } finally {
    if (currentView === scene && stateToken) { busy = false; renderView(currentView); }
  }
});
function positionDoor() {
  const width = shopStage.clientWidth, height = shopStage.clientHeight;
  const foodScale = Math.max(width / 1448, height / 1086);
  for (const node of [meatHotspot]) {
    node.style.left = `${(width - 1448 * foodScale) / 2}px`;
    node.style.top = `${(height - 1086 * foodScale) / 2}px`;
    node.style.width = `${1448 * foodScale}px`;
    node.style.height = `${1086 * foodScale}px`;
  }
  const photoScale = Math.max(width / 2528, height / 1904);
  const brazierScale = Math.max(width / 1448, height / 1086);
  for (const node of [walletHotspot, firelight]) {
    node.style.left = `${(width - 1448 * brazierScale) / 2}px`;
    node.style.top = `${(height - 1086 * brazierScale) / 2}px`;
    node.style.width = `${1448 * brazierScale}px`;
    node.style.height = `${1086 * brazierScale}px`;
  }
  for (const node of [photoHotspot, charlesHotspot]) {
    node.style.left = `${(width - 2528 * photoScale) / 2}px`;
    node.style.top = `${(height - 1904 * photoScale) / 2}px`;
    node.style.width = `${2528 * photoScale}px`;
    node.style.height = `${1904 * photoScale}px`;
  }
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
    : 'polygon(2.2% 25.5%, 16.4% 25.5%, 16.4% 44.5%, 11% 44.5%, 8.3% 56.2%, 2.4% 58.4%)';
  if (shopStage.style.setProperty) {
    shopStage.style.setProperty('--jimmy-left', `${left + 180 * scale}px`);
    shopStage.style.setProperty('--jimmy-top', `${top + 240 * scale}px`);
    shopStage.style.setProperty('--jimmy-width', `${480 * scale}px`);
    shopStage.style.setProperty('--jimmy-height', `${650 * scale}px`);
  }
}
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(positionDoor).observe(shopStage);
doorHotspot.addEventListener('click', () => {
  if (busy || !['empty_butcher', 'karen_dinner'].includes(currentView?.scene_id)) return;
  doorExamined = true;
  renderView(currentView);
});
let festivalFrame = 0;
let festivalStares = false;
let secretFrame = -1;
let karenDinnerDismissed = false;
let karenDinnerLine = 0;
let karenDepartureTimer;
let photoReactionEvents = null;
let photoReactionLine = 0;
let jobDepartureTimer;
let jobDeparturePending = false;
let jobDepartureFailed = false;
const greetingChats = new Map();
function greetingLocked(view) {
  return ['arrival', 'neighbors'].includes(view.scene_id) && view.available_characters.length > 0 &&
    (greetingChats.get(`${view.scene_id}:${view.location_id}`) || 0) < 2;
}
let angryReaction = null;
function clearReaction() {
  angryReaction = null;
}
// Presentation only: hide completed greeting destinations, without changing server actions.
const greetedPlaces = new Set();
const greetingDestinations = {visit_karen:'karen_house',visit_bob:'butcher_shop',visit_cathy:'salon'};
function focusChatWhenReady() {
  (dialogueStage.opened || dialogueStage.ready)?.then(opened => { if (opened !== false && stateToken && !input.disabled) input.focus(); });
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
  const cathyBasketScene = currentView.scene_id === 'cathy_help';
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
  const festivalScene = ['festival', 'hair_found', 'final_choice'].includes(currentView.scene_id);
  const festivalEvents = conversation.filter(item => item.kind === 'scene');
  let line = festivalScene && currentView.scene_id === 'hair_found'
    ? festivalEvents[Math.min(festivalFrame, festivalEvents.length - 1)]
    : conversation.findLast(item => item.speaker !== "user");
  if (currentView.scene_id === 'karen_dinner' && !karenDinnerDismissed) {
    const lines = conversation.filter(item => item.speaker === 'karen' && item.kind === 'scene');
    line = lines[Math.min(karenDinnerLine, lines.length - 1)] || line;
  }
  if (currentView.scene_id === 'photo_found' && photoReactionEvents) {
    line = photoReactionEvents[photoReactionLine];
  }
  const nextLine = currentView.scene_id === 'karen_dinner' && !karenDinnerDismissed && karenDinnerLine === 0
    ? () => { if (!busy) { karenDinnerLine = 1; renderView(currentView); } }
    : currentView.scene_id === 'photo_found' && photoReactionEvents && photoReactionLine < photoReactionEvents.length - 1
      ? () => { if (!busy) { ++photoReactionLine; renderView(currentView); } } : null;
  dialogueStage.render({
    background: currentView.scene_id === 'wait_dinner' ? '/assets/images/player_house_evening.png' : festivalScene ? `/assets/images/festival_${currentView.scene_id === 'festival' ? 'meal' : currentView.scene_id === 'final_choice' ? 'stares' : festivalFrame === 0 ? 'meat' : festivalStares ? 'stares' : 'hair'}.png` : currentView.scene_id === 'photo_found' ? (secretFrame < 0 ? '/assets/images/karen_secret_room.png' : '/assets/images/karen_secret_room_angle2.png') : ['butcher_search', 'empty_butcher', 'bob_caught'].includes(currentView.scene_id)
      ? '/assets/images/butcher_shop_open.png' : currentView.background,
    image: festivalScene ? null : angryReaction === selectedCharacter && selectedCharacter ? `/assets/images/${selectedCharacter}_angry.png` : cathyBasketScene ? (basketGreetingDone ? null : '/assets/images/cathy_smile.png') : currentView.scene_id === 'photo_found' && secretFrame < 2 ? null : currentView.scene_id === "karen_dinner" && (!selectedCharacter || selectedCharacter === 'karen') ? (karenDinnerDismissed ? null : line?.image || "/assets/images/karen_smile.png") : (selectedCharacter
      ? conversation.findLast(item => item.speaker === selectedCharacter && item.image)?.image || currentView.available_characters[0]?.portrait
      : line?.image) || null,
    speaker: currentView.scene_id === 'photo_found' && secretFrame < 2 ? '' : (currentView.scene_id === "empty_butcher" || currentView.scene_id === "karen_dinner" && karenDinnerDismissed) ? "" : line ? speakerName(line.speaker) : "",
    text: festivalScene ? line?.text || '' : cathyBasketScene ? (basketGreetingDone ? '' : conversation.find(item => item.speaker === 'cathy' && item.kind === 'scene')?.text || line?.text || '') : currentView.scene_id === 'photo_found' && secretFrame < 2 ? (secretFrame < 0 ? '방 안은 조용했다. 주변을 좀 살펴보자.' : secretFrame === 0 ? '저기 뭔가 익숙한 얼굴이..?' : '두 액자의 뒷면까지 살펴보자.') : currentView.scene_id === "karen_dinner" && karenDinnerDismissed ? (doorExamined ? "이 방은 뭘까?" : "") : currentView.scene_id === "empty_butcher" ? (doorExamined ? "어? 왜 문이 열려있지?" : line?.text || "") : line?.text || "",
    visitorId: selectedCharacter,
    sceneId: currentView.scene_id,
    doorbellCount: currentView.scene_id === 'checkpoint' && currentView.available_actions.some(action => action.id === 'go_butcher') ? 3 : 1,
    dialogueKey: line,
    nextLine,
    dialogue: currentView.scene_id !== 'final_choice' && !(currentView.scene_id === 'basement' && !line?.text) && (!cathyBasketScene || !basketGreetingDone),
    selectCharacter: !cathyBasketScene && !festivalScene && !['job_choice', 'job_result'].includes(currentView.scene_id),
  });
  if (cathyBasketScene && !basketGreetingDone && !basketGreetingPending) {
    basketGreetingPending = true;
    const visit = basketVisit;
    Promise.resolve(dialogueStage.ready).then(ready => {
      if (ready === false || visit !== basketVisit || currentView?.scene_id !== 'cathy_help') return;
      basketGreetingTimer = setTimeout(async () => {
        if (visit !== basketVisit || currentView?.scene_id !== 'cathy_help') return;
        await dialogueStage.depart?.(false);
        if (visit !== basketVisit || currentView?.scene_id !== 'cathy_help') return;
        basketGreetingDone = true;
        renderView(currentView);
      }, 1400);
    });
  }
  clearTimeout(karenDepartureTimer);
  if (currentView.scene_id === 'karen_dinner' && !karenDinnerDismissed && karenDinnerLine === 1) {
    Promise.resolve(dialogueStage.opened || dialogueStage.ready).then(opened => {
      if (opened === false) return;
      const depart = async () => {
        if (currentView?.scene_id !== 'karen_dinner' || karenDinnerDismissed || busy) return;
        if (shopStage.dataset.dialogueComplete === 'false' || dialogueStage.pages && dialogueStage.pageIndex < dialogueStage.pages.length - 1) {
          karenDepartureTimer = setTimeout(depart, 250);
          return;
        }
        await dialogueStage.depart?.(false);
        if (currentView?.scene_id !== 'karen_dinner') return;
        karenDinnerDismissed = true;
        renderView(currentView);
      };
      karenDepartureTimer = setTimeout(depart, 3300);
    });
  }
  log.scrollTop = log.scrollHeight;
  clearTimeout(jobDepartureTimer);
  if (currentView.scene_id === 'job_result' && !jobDeparturePending && !jobDepartureFailed) {
    const scene = currentView;
    let readAt = null;
    const depart = async () => {
      if (currentView !== scene || busy || !stateToken || jobDeparturePending) return;
      if (shopStage.dataset.dialogueComplete !== 'true') readAt = null;
      else readAt ??= Date.now();
      const page = dialogueStage.pages?.[dialogueStage.pageIndex] || '';
      const readDelay = Math.max(3200, Math.min(6500, Array.from(page).length * 75));
      if (readAt === null || Date.now() - readAt < readDelay) {
        jobDepartureTimer = setTimeout(depart, 250);
        return;
      }
      jobDeparturePending = true;
      await dialogueStage.depart?.(false);
      if (currentView !== scene || !stateToken) return;
      await performAction('see_karen_off');
      if (currentView.scene_id === 'job_result') {
        jobDepartureFailed = true;
        jobDeparturePending = false;
        renderView(currentView);
      }
    };
    Promise.resolve(dialogueStage.ready).then(() => {
      if (currentView === scene && !jobDeparturePending) jobDepartureTimer = setTimeout(depart, 250);
    });
  }
}

function renderView(view) {
  if (currentView?.scene_id !== view.scene_id) doorExamined = false;
  currentView = view;
  if (view.scene_id === 'photo_found' && view.available_actions.some(a => a.id === 'return_home')) secretFrame = 2;
  basketHotspot.hidden = view.scene_id !== 'cathy_help' || !basketDialog || !basketGreetingDone;
  basketHotspot.disabled = busy;
  renderBasket();
  window.locationMusic?.enter(view.location_id, view.ending, view.scene_id);
  photoHotspot.hidden = view.scene_id !== 'photo_found' || secretFrame < 0 || secretFrame === 2;
  photoHotspot.disabled = busy;
  charlesHotspot.hidden = photoHotspot.hidden;
  charlesHotspot.disabled = busy;
  photoFlip.disabled = busy;
  if (photoHotspot.hidden && photoDialog.open && !busy) photoDialog.close();
  walletHotspot.hidden = !walletInspection || view.scene_id !== 'basement' || !view.available_actions.some(a => a.id === 'inspect_wallet');
  walletHotspot.disabled = busy;
  firelight.hidden = view.scene_id !== 'basement';
  if (view.scene_id !== 'basement') walletInspection?.close();
  const emptyShop = view.scene_id === 'empty_butcher' || view.scene_id === 'karen_dinner' && karenDinnerDismissed;
  shopStage.setAttribute('data-scene', view.scene_id);
  document.getElementById('dialogue-stage').setAttribute('data-empty-shop', String(emptyShop && !doorExamined && view.scene_id !== 'empty_butcher'));
  doorHotspot.hidden = !emptyShop || doorExamined || !view.available_actions.some(a => ['inspect_basement', 'inspect_room'].includes(a.id));
  doorHotspot.disabled = busy;
  doorHotspot.setAttribute('aria-label', view.scene_id === 'karen_dinner' ? '방 문 살펴보기' : '열린 문 살펴보기');
  if (emptyShop || view.scene_id === 'butcher_search' || !photoHotspot.hidden || !walletHotspot.hidden) positionDoor();
  const place = view.location_name || view.location_id;
  document.getElementById("location-title").textContent = place;
  const background = document.getElementById("scene-background");
  background.style.backgroundImage = view.background ? `url("${view.background}")` : "none";
  background.setAttribute("aria-label", `${place} 배경`);
  document.getElementById("affinity-value").textContent = `${view.affinity} / 100`;

  actionList.replaceChildren();
  const festival = ['festival', 'hair_found', 'final_choice'].includes(view.scene_id);
  const showingDiscovery = ['hair_found', 'final_choice'].includes(view.scene_id);
  const secretDiscovery = view.scene_id === 'photo_found' && secretFrame < 2;
  const karenGreeting = view.scene_id === 'karen_dinner' && !karenDinnerDismissed;
  const enteringRoom = view.scene_id === 'photo_found' && secretFrame < 0;
  meatHotspot.hidden = view.scene_id !== 'hair_found' || festivalFrame !== 0;
  meatHotspot.disabled = busy;
  if (!meatHotspot.hidden) positionDoor();
  exploreHint.textContent = !meatHotspot.hidden ? '음식을 살펴보자. 고기를 눌러 확인해 보세요.' : !basketHotspot.hidden ? '바구니를 눌러보자.' : !doorHotspot.hidden ? '주변을 둘러보자. 열린 문을 살펴볼까?' : !photoHotspot.hidden ? '두 액자를 눌러서 확인해 보자.' : '';
  if (view.scene_id === 'basement') exploreHint.textContent = '옷 주머니의 지갑을 눌러 살펴보자.';
  if (view.scene_id === 'truck_escape') exploreHint.textContent = '시간이 없어! 트럭 차문을 눌러보자.';
  exploreHint.hidden = !exploreHint.textContent;
  postMoveUI.setSplit?.(!view.ending && view.scene_id !== 'cathy_help');
  if (enteringRoom) {
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'action-button';
    next.textContent = '방을 살펴본다';
    next.disabled = busy;
    next.addEventListener('click', async () => {
      if (busy) return;
      if (enteringRoom) ++secretFrame;
      else ++festivalFrame;
      if (window.sceneEffects) {
        busy = true;
        try {
          await window.sceneEffects.transition(async () => {
            renderView(currentView);
            await (dialogueStage.backgroundReady || dialogueStage.ready);
          });
          await dialogueStage.ready;
        }
        finally { busy = false; renderView(currentView); }
      } else renderView(currentView);
    });
    actionList.append(next);
  }
  if (view.scene_id === 'neighbors' && Object.values(greetingDestinations).includes(view.location_id)) {
    greetedPlaces.add(view.location_id);
  }
  for (const action of view.available_actions) {
    if (['truck_escape', 'truck_escape_result'].includes(view.scene_id)) continue;
    if (view.scene_id === 'job_result' && action.id === 'see_karen_off' && !jobDepartureFailed) continue;
    if (view.scene_id === 'photo_found' && photoReactionEvents && photoReactionLine < photoReactionEvents.length - 1 && action.id === 'return_home') continue;
    if (showingDiscovery || secretDiscovery || karenGreeting || emptyShop && !doorExamined || greetingLocked(view) && action.kind === 'move') continue;
    if (view.scene_id === 'cathy_help' || view.scene_id === 'basement' && action.id.includes('wallet')) continue;
    if (view.scene_id === 'neighbors' && action.kind === 'move' && greetedPlaces.has(greetingDestinations[action.id])) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-button ${action.kind}`;
    button.textContent = view.scene_id === 'job_result' && action.id === 'see_karen_off' ? '계속하기' : emptyShop && action.id === 'inspect_basement' ? '지하실에 내려가본다' : emptyShop && action.id === 'inspect_room' ? '방에 들어가본다' : action.label;
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
  document.getElementById("ending-restart").hidden = !view.ending || view.ending === 'death';
  const canChat = !!character && !view.ending && !festival && !secretDiscovery && view.scene_id !== 'karen_dinner';
  input.disabled = busy || !canChat;
  document.getElementById("send-btn").disabled = input.disabled;
  input.placeholder = view.ending ? "" : character ? `${character.name}에게 말을 걸어 보세요` : "먼저 장소를 선택하세요";
  postMoveUI.render({sceneId: view.scene_id, locationId: view.location_id, locationName: place,
    characterId: character?.id, canChat, registeredName: playerName,
    gender: view.gender, today: view.today, job: view.job,
    affinity: view.affinity, actions: greetingLocked(view) || showingDiscovery || secretDiscovery || view.scene_id === 'cathy_help' || view.scene_id === 'photo_found' && photoReactionEvents && photoReactionLine < photoReactionEvents.length - 1 ? [] : view.available_actions, busy});
  renderMessages();
  truckEscape?.update(view, busy);
  festivalChoice?.update({reading: view.scene_id === 'hair_found' && festivalFrame === 1,
    ready: () => !busy && shopStage.dataset.dialogueComplete === 'true',
    onRead: () => {
      festivalStares = true;
      return dialogueStage.replaceBackground('/assets/images/festival_stares.png');
    },
    deadline: view.scene_id === 'final_choice' ? view.choice_deadline : null, busy});
  const endingText = transcript.filter(item => item.scene_id === view.scene_id && item.kind === 'scene').map(item => item.text).join(' ');
  window.sceneEffects?.ending(view.ending, endingText, view.gender, view.location_id);
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
    charlesPhotoDate = '';
    clearTimeout(jobDepartureTimer);
    jobDeparturePending = false;
    jobDepartureFailed = false;
    festivalFrame = 0;
    festivalStares = false;
    secretFrame = -1;
    karenDinnerDismissed = false;
    karenDinnerLine = 0;
    photoReactionEvents = null;
    photoReactionLine = 0;
    clearTimeout(basketTimer);
    basketTimer = undefined;
    basketStarted = false;
    basketReady = false;
    basketCountdown = 3;
    clearTimeout(basketGreetingTimer);
    ++basketVisit;
    basketGreetingDone = false;
    basketGreetingPending = false;
    cathySelected.clear();
    if (basketDialog?.open) basketDialog.close();
  }
  stateToken = data.state_token;
  for (const item of data.events) {
    saveMessage({speaker: item.speaker_id, text: item.text, image: item.image, kind,
      character_id: characterId, scene_id: data.view.scene_id, location_id: data.view.location_id});
  }
  if (data.view.scene_id === 'photo_found' && data.events.some(item => item.speaker_id === 'karen')) {
    photoReactionEvents = data.events.map(item => ({speaker: item.speaker_id, text: item.text, image: item.image}));
    photoReactionLine = 0;
  }
  renderView(data.view);
}

window.startStory = (data, name) => {
  ++photoOpenVersion;
  festivalChoice?.reset();
  dialogueStage.resetSelection?.();
  const continuingVisit = window.entryVisitReady && data.view.location_id === 'player_house' &&
    data.view.available_characters.some(character => character.id === 'jimmy');
  if (continuingVisit) {
    dialogueStage.skipSelectionOnce = true;
    dialogueStage.homeVisitor = 'jimmy';
    dialogueStage.visitorVisible = true;
    dialogueStage.root?.setAttribute('data-continuing', 'true');
  }
  window.entryVisitReady = false;
  playerName = name;
  festivalFrame = 0;
  festivalStares = false;
  secretFrame = -1;
  karenDinnerDismissed = false;
  clearReaction();
  transcript = [];
  walletInspection?.close();
  greetedPlaces.clear();
  greetingChats.clear();
  if (photoDialog.open) photoDialog.close();
  clearPhotoThought();
  selectedPhoto = 'jimmy';
  showPhotoSide(false);
  if (basketDialog?.open) basketDialog.close();
  clearTimeout(basketTimer);
  basketTimer = undefined;
  basketStarted = false;
  basketReady = false;
  basketCountdown = 3;
  clearTimeout(basketGreetingTimer);
  ++basketVisit;
  basketGreetingDone = false;
  basketGreetingPending = false;
  cathySelected.clear();
  clearTimeout(karenDepartureTimer);
  doorExamined = false;
  currentView = null;
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
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("서버 응답을 받지 못했습니다. 잠시 후 다시 보내 주세요.");
  }
  if (!response.ok) throw new Error(data.error?.message || "요청을 처리하지 못했습니다.");
  if (path === '/api/action' && payload.action_id === 'approach_jimmy' && currentView?.scene_id === 'butcher_search') {
    await dialogueStage.depart?.(true);
  }
  const show = async () => {
    applyResponse(data, path === "/api/chat" ? "chat" : "scene", payload.character_id);
    await (dialogueStage.backgroundReady || dialogueStage.ready);
  };
  const dateChanged = currentView?.today && data.view.today && currentView.today !== data.view.today;
  const moving = currentView && (currentView.location_id !== data.view.location_id || currentView.background !== data.view.background || dateChanged || data.view.ending && !currentView.ending);
  if (moving && window.sceneEffects) await window.sceneEffects.transition(show, dateChanged ? {from: currentView.today, to: data.view.today} : null);
  else await show();
  await dialogueStage.ready;
}

async function performAction(actionId) {
  const truckAction = ['truck_escape', 'truck_escape_result'].includes(currentView?.scene_id) && ['begin_truck_escape', 'open_truck_door', 'truck_timeout', 'finish_truck_escape'].includes(actionId);
  const photoAction = currentView?.scene_id === 'photo_found' && ['inspect_photo_back', 'recognize_photo', 'inspect_charles_photo', 'inspect_charles_photo_back', 'recognize_charles_photo'].includes(actionId);
  if (!photoAction && !truckAction && shopStage.dataset?.dialogueComplete === 'false' && dialogueStage.box && !dialogueStage.box.hidden) return;
  if (busy || !stateToken) return false;
  if (greetingLocked(currentView) && currentView.available_actions.some(a => a.id === actionId && a.kind === 'move')) return;
  if (currentView.scene_id === 'photo_found' && secretFrame < 2 &&
      !photoAction) return;
  if (currentView.scene_id === 'hair_found' && (festivalFrame !== 1 || actionId !== 'begin_final_choice')) return;
  busy = true;
  renderView(currentView);
  statusMessage.textContent = "이야기가 이어지는 중…";
  try {
    await request("/api/action", {state_token: stateToken, action_id: actionId});
    statusMessage.textContent = "";
    if (basketStatus) basketStatus.textContent = '';
    return true;
  } catch (error) {
    statusMessage.textContent = error.message;
    if (basketStatus && currentView?.scene_id === 'cathy_help') basketStatus.textContent = error.message;
    return false;
  }
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
  ++photoOpenVersion;
  truckEscape?.reset();
  walletInspection?.close();
  clearTimeout(jobDepartureTimer);
  jobDeparturePending = true;
  dialogueStage.resetSelection?.();
  clearReaction();
  greetedPlaces.clear();
  greetingChats.clear();
  if (photoDialog.open) photoDialog.close();
  clearPhotoThought();
  if (basketDialog?.open) basketDialog.close();
  clearTimeout(basketTimer);
  basketTimer = undefined;
  basketStarted = false;
  basketReady = false;
  basketCountdown = 3;
  clearTimeout(basketGreetingTimer);
  ++basketVisit;
  basketGreetingDone = false;
  basketGreetingPending = false;
  cathySelected.clear();
  clearTimeout(karenDepartureTimer);
  doorExamined = false;
  stateToken = null;
  transcript = [];
});
document.getElementById('restart-btn').addEventListener('click', () => { if (!busy) window.location.reload(); });
document.getElementById('ending-restart').addEventListener('click', () => { if (!busy) window.location.assign('/'); });
window.addEventListener("pageshow", event => {
  document.getElementById("username").value = "";
  if (event.persisted) window.location.reload();
});
