// 장소와 인물의 대화 화면을 개발용으로 미리 보여 준다.
const previewStage = new DialogueStage(document.getElementById('preview-stage'));
let previewMode = 'tv';
const previewForm = document.getElementById('preview-form');
const previewMoves = {visit_neighbors:'square',visit_bob:'bob',visit_cathy:'cathy',visit_karen:'karen',return_home:'jimmy'};
const previewUI = new PostMoveUI(document.getElementById('preview-stage'), previewForm, document.getElementById('preview-input'), document.getElementById('preview-send'), id => {
  previewMode = previewMoves[id]; renderPreview();
});
previewForm.addEventListener('submit', event => event.preventDefault());
const scenes = {
  karen_smile: {speaker:'캐런', background:'/assets/images/karen_house.svg', image:'/assets/images/karen_smile.png'},
  secret: {speaker:'', background:'/assets/images/karen_secret_room.png', image:null},
  secret_angle: {speaker:'', background:'/assets/images/karen_secret_room_angle2.png', image:null},
  basement: {speaker:'', background:'/assets/images/basement.svg', image:null},
  jimmy: { speaker: '지미', background: '/assets/images/player_house.svg', image: '/assets/images/jimmy_basic.png' },
  karen: { speaker: '캐런', background: '/assets/images/karen_house.svg', image: '/assets/images/karen_basic.png' },
  bob: { speaker: '밥', background: '/assets/images/butcher_shop.svg', image: '/assets/images/bob_basic.png' },
  cathy: { speaker: '캐시', background: '/assets/images/salon.svg', image: '/assets/images/cathy_basic.png' },
  square: { speaker: '', background: '/assets/images/square.svg', image: null },
};
function renderPreview() {
  const demo = '[개발용 배치 확인 문구 · 실제 스토리 대사 아님]';
  const tv = previewMode === 'tv' || previewMode === 'long';
  previewStage.render({
    ...(scenes[previewMode] || {}),
    ...(tv ? {background: '/assets/images/pre-move-house.png'} : {}),
    object: null,
    image: tv ? null : previewMode === 'missing' ? '/assets/images/dev-missing.png' : scenes[previewMode]?.image,
    speaker: tv ? '' : scenes[previewMode]?.speaker ?? '밥',
    text: previewMode === 'long' ? Array(30).fill(demo).join('\n') : demo,
  });
  const locationIds = {jimmy:'player_house',karen:'karen_house',karen_smile:'karen_house',secret:'karen_house',secret_angle:'karen_house',basement:'basement',bob:'butcher_shop',cathy:'salon',square:'square'};
  const labels = {jimmy:'새집',karen:'캐런의 집',karen_smile:'캐런의 집',secret:'비밀 방 (개발용)',secret_angle:'비밀 방 (개발용)',basement:'정육점 지하실',bob:'정육점',cathy:'미용실',square:'마을 광장'};
  previewUI.setSplit(!tv);
  previewUI.render({locationId:locationIds[previewMode] || 'butcher_shop', locationName:labels[previewMode] || '정육점', affinity:80,
    actions:Object.keys(previewMoves).map(id=>({id,kind:'move',label:'개발용 장소 전환'}))});
}
for (const mode of ['tv', 'jimmy', 'karen', 'bob', 'cathy', 'long', 'missing', 'karen_smile', 'secret', 'secret_angle', 'basement']) {
  document.getElementById(mode).addEventListener('click', () => { previewMode = mode; renderPreview(); });
}
renderPreview();
