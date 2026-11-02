// Presentation mapping only. An icon never invents a server action.
window.postMoveNavigation = function(locationId, actions) {
  const home = locationId === 'player_house';
  const slots = home ? [
    ['butcher_shop', '정육점', 'visit_bob', 'carrot'],
    ['salon', '미용실', 'visit_cathy', 'scissors'],
    ['square', '마을 광장', 'visit_neighbors', 'park'],
    ['karen_house', '캐런의 집', 'visit_karen', 'star'],
  ] : [['player_house', '집으로 돌아가기', 'return_home', 'home']];
  return slots.map(([id, label, actionId, icon]) => ({
    id, label, icon, action: actions.find(a => a.id === actionId && a.kind === 'move') || null,
  }));
};
window.PostMoveUI = class {
  constructor(stage, form, input, send, onMove) {
    this.stage = stage;
    this.input = input;
    this.send = send;
    this.onMove = onMove;
    const frame = document.createElement('div');
    frame.className = 'post-move-screen';
    if (stage.classList.contains('game-screen')) {
      stage.classList.remove('game-screen');
      frame.classList.add('game-screen');
    }
    stage.parentNode.insertBefore(frame, stage);
    frame.insertAdjacentHTML('beforeend', `
      <aside class="move-sidebar" aria-label="호감도와 입력 도움말">
        <div class="move-affinity">호감도<strong>— / 100</strong></div>
        <div class="move-hints" aria-label="입력 도움말"></div>
      </aside>`);
    frame.append(stage);
    this.frame = frame;
    stage.classList.add('post-move-stage');
    stage.insertAdjacentHTML('beforeend', `
      <header class="move-top"><h1 class="move-location"></h1></header>
      <nav class="move-nav" aria-label="장소 이동"></nav>
      <div class="move-composer"></div>`);
    this.title = stage.querySelector('.move-location');
    this.affinity = frame.querySelector('.move-affinity strong');
    this.nav = stage.querySelector('.move-nav');
    this.hints = frame.querySelector('.move-hints');
    stage.querySelector('.move-composer').append(form);
    const suggestions = [
      ['마을에 대해 묻기', '마을에 대해 알려 주세요.'],
      ['자세히 물어보기', '조금 더 자세히 이야기해 주세요.'],
    ];
    for (const [label, text] of suggestions) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.addEventListener('click', () => {
        if (input.disabled) return;
        input.value = text; input.focus();
        input.dispatchEvent(new Event('input', {bubbles: true}));
      });
      this.hints.append(button);
    }
  }
  setSplit(enabled) {
    this.frame.classList.toggle('is-intro', !enabled);
  }
  render({locationId, locationName, registeredName = null, affinity = null, actions = [], busy = false}) {
    this.title.textContent = locationId === 'player_house' && registeredName ? `${registeredName} 하우스` : locationName;
    this.title.title = this.title.textContent;
    this.affinity.textContent = affinity === null ? '— / 100' : `${affinity} / 100`;
    this.affinity.parentElement.title = '마을 호감도';
    this.nav.replaceChildren();
    for (const slot of postMoveNavigation(locationId, actions)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'move-icon';
      button.setAttribute('aria-label', slot.label);
      button.title = slot.action ? slot.action.label : `${slot.label} · 현재 서버에서 허용되지 않은 이동`;
      button.disabled = busy || !slot.action;
      // Static icon geometry; all variable names/labels use textContent.
      const paths = {
        home: '<path d="M3 11 12 3l9 8M6 10v11h12V10M10 21v-7h4v7"/>',
        carrot: '<path d="m6 9 9 9L3 22ZM13 10l5-7 2 2-5 7M15 12l7-2-1-3-6 3"/>',
        scissors: '<circle cx="6" cy="17" r="4"/><circle cx="18" cy="17" r="4"/><path d="m8 14 10-12M16 14 6 2"/>',
        park: '<path d="m2 10 10-7 10 7ZM5 11v10m5-10v10m4-10v10m5-10v10M2 22h20"/>',
        star: '<path d="m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"/>',
      };
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[slot.icon]}</svg>`;
      button.addEventListener('click', () => { if (!button.disabled) this.onMove(slot.action.id); });
      this.nav.append(button);
    }
    for (const button of this.hints.children) button.disabled = this.input.disabled || busy;
  }
};
