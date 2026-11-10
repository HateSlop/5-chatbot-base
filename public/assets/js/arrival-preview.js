// 이사 직후 장면을 개발 화면에서 미리 보여 준다.
// Isolated scene prototype: never call the API or write a progress/name token.
const arrivalRoot = document.getElementById('arrival-stage');
const arrivalStage = new DialogueStage(arrivalRoot);
const arrivalChat = document.getElementById('arrival-chat');
const arrivalMessage = document.getElementById('arrival-message');
const arrivalSend = document.getElementById('arrival-send');
const arrivalDialog = document.getElementById('arrival-name-dialog');
const arrivalName = document.getElementById('arrival-name');
const arrivalError = document.getElementById('arrival-name-error');
const arrivalStatus = document.getElementById('arrival-status');
const arrivalAnswer = document.getElementById('arrival-answer');
const arrivalUI = new PostMoveUI(arrivalRoot, arrivalChat, arrivalMessage, arrivalSend, () => {});
const arrivalBox = arrivalRoot.querySelector('.dialogue-box');
const arrivalComposer = arrivalRoot.querySelector('.move-composer');
const jimmyQuestion = '더뉴빌리지에 온 걸 환영해. 여기 진짜 끝내주는 곳이거든! 아 참, 너의 이름은 뭐야?';
const arrivalBackground = '/assets/images/player_house.svg';
let arrivalTimer;
let arrivalRun = 0;
let arrivalReady = false;
let arrivalAwaitingName = false;
function renderArrivalUI(name = null) {
  arrivalUI.render({locationId:'player_house', locationName:'새집', registeredName:name, busy:!arrivalReady});
}
async function replayArrival() {
  const run = ++arrivalRun;
  clearTimeout(arrivalTimer);
  if (arrivalDialog.open) arrivalDialog.close();
  arrivalReady = false;
  arrivalAwaitingName = false;
  arrivalAnswer.hidden = true;
  arrivalBox.hidden = arrivalComposer.hidden = arrivalChat.hidden = true;
  arrivalName.value = '';
  arrivalName.removeAttribute('aria-invalid');
  arrivalError.textContent = '';
  arrivalMessage.value = '';
  arrivalMessage.disabled = arrivalSend.disabled = true;
  arrivalStatus.textContent = '지미가 찾아오기 전입니다.';
  arrivalStage.render({background:arrivalBackground, dialogue:false});
  renderArrivalUI();
  // Count from when the background is available, including a color fallback on failure.
  await arrivalRoot.querySelector('.dialogue-background').decode().catch(() => {});
  if (run !== arrivalRun) return;
  arrivalTimer = setTimeout(async () => {
    arrivalStage.render({background:arrivalBackground, image:'/assets/images/jimmy_smile.png', speaker:'지미', text:jimmyQuestion});
    if (arrivalStage.ready) await arrivalStage.ready;
    if (run !== arrivalRun) return;
    arrivalChat.hidden = false;
    arrivalAwaitingName = true;
    arrivalAnswer.hidden = false;
    arrivalStatus.textContent = '지미의 대사를 읽고 이름 입력하기를 눌러 주세요.';
  }, 3000);
}
arrivalAnswer.addEventListener('click', () => {
  if (!arrivalAwaitingName || arrivalReady || arrivalDialog.open) return;
  arrivalDialog.showModal();
  arrivalName.focus();
});
arrivalDialog.addEventListener('cancel', event => event.preventDefault());
arrivalName.addEventListener('input', () => {arrivalError.textContent = ''; arrivalName.removeAttribute('aria-invalid');});
document.getElementById('arrival-name-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!arrivalDialog.open || arrivalReady) return;
  const name = arrivalName.value.trim();
  if (!name || Array.from(name).length > 50) {
    arrivalError.textContent = '이름을 공백을 제외한 1~50자로 입력해 주세요.';
    arrivalName.setAttribute('aria-invalid', 'true');
    arrivalName.focus();
    return;
  }
  arrivalReady = true;
  arrivalAwaitingName = false;
  arrivalAnswer.hidden = true;
  arrivalDialog.close();
  arrivalMessage.disabled = arrivalSend.disabled = false;
  arrivalStage.render({background:arrivalBackground, image:'/assets/images/jimmy_smile.png', speaker:'지미', text:`그래 ${name}이구나! 반가워! 잘 지내보자.`});
  renderArrivalUI(name);
  arrivalStatus.textContent = '개발용 이름 입력 완료 · 실제 게임에 저장하지 않았습니다.';
  arrivalMessage.focus();
});
arrivalChat.addEventListener('submit', event => {event.preventDefault(); arrivalStatus.textContent = '이 미리보기에서는 대화를 전송하지 않습니다.';});
document.getElementById('arrival-replay').addEventListener('click', replayArrival);
window.addEventListener('pagehide', () => {++arrivalRun; clearTimeout(arrivalTimer);});
window.addEventListener('pageshow', event => {
  if (event.persisted && !arrivalReady && !arrivalAwaitingName && !arrivalDialog.open) replayArrival();
});
replayArrival();
