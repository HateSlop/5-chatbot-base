// Pre-session presentation only; name-entry.js creates the actual server session.
const entryRoot = document.getElementById('entry-stage');
const entryStage = new DialogueStage(entryRoot);
const entryInput = document.getElementById('entry-message');
const entryForm = document.getElementById('entry-chat');
const entryUI = new PostMoveUI(entryRoot, entryForm, entryInput, document.getElementById('entry-send'), () => {});
const entryDialog = document.getElementById('entry-name-dialog');
const entryAnswer = document.getElementById('entry-answer');
const entryTV = document.getElementById('entry-tv-hotspot');
const entryTVTutorial = document.getElementById('entry-tv-tutorial');
function hideTVTutorial() { if (entryTVTutorial) entryTVTutorial.hidden = true; }
entryTVTutorial?.addEventListener('animationend', event => {
  if (event.animationName === 'entry-tv-demo') hideTVTutorial();
});
// Match the original TV cutout to the background's object-fit: cover crop.
function positionEntryTV() {
  const width = entryRoot.clientWidth, height = entryRoot.clientHeight;
  if (!width || !height) return;
  const scale = Math.max(width / 1456, height / 816);
  entryTV.style.left = `${(width - 1456 * scale) / 2}px`;
  entryTV.style.top = `${(height - 816 * scale) / 2}px`;
  entryTV.style.width = `${1456 * scale}px`;
  entryTV.style.height = `${816 * scale}px`;
  if (entryTVTutorial) {
    entryTVTutorial.style.left = `${(width - 1456 * scale) / 2 + 720 * scale}px`;
    entryTVTutorial.style.top = `${(height - 816 * scale) / 2 + 404 * scale}px`;
  }
}
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(positionEntryTV).observe(entryRoot);
const prologueRoot = document.getElementById('entry-prologue');
const prologue = prologueRoot && window.Prologue ? new window.Prologue(prologueRoot) : null;
const adDialog = document.getElementById('entry-ad-dialog');
const adVideo = document.getElementById('entry-ad-video');
const adStatus = document.getElementById('entry-ad-status');
const adRetry = document.getElementById('entry-ad-retry');
const adContinue = document.getElementById('entry-ad-continue');
let introStep = 'before';
async function playAd() {
  adRetry.hidden = true;
  adStatus.textContent = '';
  try { await adVideo.play(); }
  catch { adStatus.textContent = '재생 버튼을 눌러 광고를 봐 주세요.'; adRetry.hidden = false; }
}
async function finishAd() {
  if (introStep !== 'playing') return;
  introStep = 'after';
  adVideo.pause();
  adDialog.close();
  entryStage.render({background:'/assets/images/pre-move-house.png',speaker:'',text:'오…? 이런 곳도 있었네?\n\n마을도 평화로워 보이고, 사람들도 다들 좋아 보이는데…\n\n여기라면 나도 새롭게 시작할 수 있지 않을까?\n\n좋아, 한번 가보자!'});
  if (entryStage.ready) await entryStage.ready;
  if (introStep !== 'after') return;
  entryDepart.hidden = false;
  entryStage.layoutPages?.();
  entryDepart.focus();
}
entryTV.addEventListener('click', () => {
  if (introStep !== 'before') return;
  introStep = 'playing';
  entryStage.finishTyping?.();
  entryTV.hidden = true;
  hideTVTutorial();
  adContinue.hidden = true;
  adDialog.showModal();
  playAd();
});
adRetry.addEventListener('click', playAd);
adVideo.addEventListener('ended', finishAd);
adVideo.addEventListener('error', () => {
  adStatus.textContent = '광고를 불러오지 못했습니다. 다시 재생하거나 계속 진행해 주세요.';
  adRetry.hidden = false;
  adContinue.hidden = false;
});
adContinue.addEventListener('click', finishAd);
adDialog.addEventListener('cancel', event => event.preventDefault());
const entryDepart = document.getElementById('entry-depart');
let departed = false;
let entryRun = 0;
let entryTimer;
async function showEntry() {
  entryUI.setSplit(true);
  entryDepart.hidden = true;
  const run = ++entryRun;
  entryStage.render({background:'/assets/images/player_house.svg', dialogue:false});
  window.locationMusic?.enter('player_house');
  entryUI.render({locationId:'player_house',locationName:'새집',busy:true});
  if (entryStage.backgroundReady) await entryStage.backgroundReady;
  else await entryRoot.querySelector('.dialogue-background').decode().catch(() => {});
  if (run !== entryRun) return;
  entryTimer = setTimeout(async () => {
    if (document.getElementById('name-screen').hidden) return;
    entryStage.render({background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_smile.svg',speaker:'지미',selectCharacter:true,
      text:'더뉴빌리지에 온 걸 환영해. 여기 진짜 끝내주는 곳이거든! 아 참, 너의 이름은 뭐야?'});
    if (entryStage.ready) await entryStage.ready;
    if (run !== entryRun || document.getElementById('name-screen').hidden) return;
    window.entryVisitReady = true;
    entryAnswer.hidden = false;
  },1500);
}
entryAnswer.addEventListener('click',()=>{entryDialog.showModal();document.getElementById('username').focus();});
entryDialog.addEventListener('cancel',event=>event.preventDefault());
window.addEventListener('pagehide',()=>{++entryRun;clearTimeout(entryTimer);introStep='left';entryTV.hidden=true;hideTVTutorial();adVideo.pause();adDialog.close();});
entryDepart.addEventListener('click', async () => {
  if (departed || introStep !== 'after') return;
  departed = true;
  if (window.sceneEffects) await window.sceneEffects.transition(showEntry);
  else showEntry();
});
async function showIntro() {
  entryUI.setSplit(false);
  entryAnswer.hidden = true;
  entryDepart.hidden = true;
  entryTV.hidden = true;
  hideTVTutorial();
  entryStage.render({background:'/assets/images/pre-move-house.png', dialogue:false});
  if (entryStage.ready) await entryStage.ready;
  if (introStep !== 'before') return;
  if (prologue) {
    introStep = 'prologue';
    entryRoot.inert = true;
    const finished = await prologue.play();
    entryRoot.inert = false;
    if (!finished || introStep === 'left') return;
    introStep = 'before';
  }
  entryStage.render({background:'/assets/images/pre-move-house.png',speaker:'',text:'하아… 생각만 한다고 달라지는 건 없겠지.\n\n일단 TV나 볼까…? 뭐라도 보고 있으면 좀 나아지려나.'});
  if (entryStage.ready) await entryStage.ready;
  if (!departed && introStep === 'before') {
    positionEntryTV();
    entryTV.hidden = false;
    if (entryTVTutorial) entryTVTutorial.hidden = false;
    entryStage.layoutPages?.();
    if (prologue) entryTV.focus();
  }
}
showIntro();
