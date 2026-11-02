const previewStage = new DialogueStage(document.getElementById('preview-stage'));
let previewMode = 'tv';
const scenes = {
  jimmy: { speaker: '지미', background: '/assets/images/player_house.svg', image: '/assets/images/jimmy_neutral.svg' },
  karen: { speaker: '캐런', background: '/assets/images/karen_house.svg', image: '/assets/images/karen_neutral.svg' },
  bob: { speaker: '밥', background: '/assets/images/butcher_shop.svg', image: '/assets/images/bob_neutral.svg' },
  cathy: { speaker: '캐시', background: '/assets/images/salon.svg', image: '/assets/images/cathy_neutral.svg' },
};
function renderPreview() {
  const demo = '[개발용 배치 확인 문구 · 실제 스토리 대사 아님]';
  const tv = previewMode === 'tv' || previewMode === 'long';
  previewStage.render({
    ...(scenes[previewMode] || {}),
    object: tv ? 'tv' : null,
    image: tv ? null : previewMode === 'missing' ? '/assets/images/dev-missing.png' : scenes[previewMode]?.image,
    speaker: tv ? '' : scenes[previewMode]?.speaker || '밥',
    text: previewMode === 'long' ? Array(30).fill(demo).join('\n') : demo,
  });
}
for (const mode of ['tv', 'jimmy', 'karen', 'bob', 'cathy', 'long', 'missing']) {
  document.getElementById(mode).addEventListener('click', () => { previewMode = mode; renderPreview(); });
}
renderPreview();
