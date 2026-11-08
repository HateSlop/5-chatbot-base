// Pre-session presentation only; name-entry.js creates the actual server session.
const entryRoot = document.getElementById('entry-stage');
const entryStage = new DialogueStage(entryRoot);
const entryInput = document.getElementById('entry-message');
const entryForm = document.getElementById('entry-chat');
const entryUI = new PostMoveUI(entryRoot, entryForm, entryInput, document.getElementById('entry-send'), () => {});
const entryDialog = document.getElementById('entry-name-dialog');
const entryAnswer = document.getElementById('entry-answer');
const entryDepart = document.getElementById('entry-depart');
let departed = false;
let entryRun = 0;
let entryTimer;
async function showEntry() {
  entryUI.setSplit(true);
  entryDepart.hidden = true;
  const run = ++entryRun;
  entryStage.render({background:'/assets/images/player_house.svg', dialogue:false});
  entryUI.render({locationId:'player_house',locationName:'새집',busy:true});
  await entryRoot.querySelector('.dialogue-background').decode().catch(() => {});
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
window.addEventListener('pagehide',()=>{++entryRun;clearTimeout(entryTimer);});
entryDepart.addEventListener('click', async () => {
  if (departed) return;
  departed = true;
  if (window.sceneEffects) await window.sceneEffects.transition(showEntry);
  else showEntry();
});
async function showIntro() {
  entryUI.setSplit(false);
  entryAnswer.hidden = true;
  // No confirmed monologue has been supplied. Never invent or store story text.
  entryStage.render({background:'/assets/images/pre-move-house.png',speaker:'',text:''});
  if (entryStage.ready) await entryStage.ready;
  if (!departed) entryDepart.hidden = false;
}
showIntro();
