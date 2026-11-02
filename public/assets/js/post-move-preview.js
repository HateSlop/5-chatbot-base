const moveRoot = document.getElementById('move-preview');
const moveStage = new DialogueStage(moveRoot);
const demoForm = document.getElementById('demo-form');
const demoName = document.getElementById('demo-name');
let demoLocation = 'player_house';
const demoPlaces = {
  player_house: ['내 집', 'player_house', 'jimmy', '지미'],
  butcher_shop: ['정육점', 'butcher_shop', 'bob', '밥'],
  salon: ['미용실', 'salon', 'cathy', '캐시'],
  square: ['마을 광장', 'square', null, ''],
  karen_house: ['캐런의 집', 'karen_house', 'karen', '캐런'],
};
const demoTargets = {visit_bob:'butcher_shop',visit_cathy:'salon',visit_neighbors:'square',visit_karen:'karen_house',return_home:'player_house'};
const moveUI = new PostMoveUI(moveRoot, demoForm, document.getElementById('demo-input'), document.getElementById('demo-send'), id => {
  demoLocation = demoTargets[id]; renderMoveDemo();
});
function renderMoveDemo() {
  const [label, background, character, speaker] = demoPlaces[demoLocation];
  moveStage.render({background:`/assets/images/${background}.svg`,image:character ? `/assets/images/${character}_neutral.svg` : null,speaker,text:'[개발용 배치 확인 문구 · 실제 스토리 대사 아님]'});
  moveUI.render({locationId:demoLocation,locationName:label,registeredName:demoName.value.trim(),affinity:80,
    actions:Object.keys(demoTargets).map(id=>({id,kind:'move',label:'개발용 장소 전환'}))});
}
document.getElementById('demo-home').addEventListener('click',()=>{demoLocation='player_house';renderMoveDemo();});
document.getElementById('demo-outside').addEventListener('click',()=>{demoLocation='butcher_shop';renderMoveDemo();});
demoName.addEventListener('input',renderMoveDemo);
demoForm.addEventListener('submit',event=>{event.preventDefault();document.getElementById('demo-status').textContent='개발용 입력 확인 완료 · 전송하거나 저장하지 않았습니다.';});
renderMoveDemo();
