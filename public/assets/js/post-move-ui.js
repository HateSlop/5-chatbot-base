// Presentation mapping only. An icon never invents a server action.
window.postMoveNavigation = function(locationId, actions) {
  const home = locationId === 'player_house';
  const slots = home ? [
    ['butcher_shop', '정육점', 'visit_bob', 'steak'],
    ['salon', '미용실', 'visit_cathy', 'scissors'],
    ['square', '마을 광장', 'visit_neighbors', 'park'],
    ['karen_house', '캐런의 집', 'visit_karen', 'star'],
  ] : [['player_house', '집으로 돌아가기', 'return_home', 'home']];
  return slots.map(([id, label, actionId, icon]) => ({
    id, label, icon, action: actions.find(a => a.id === actionId && a.kind === 'move') || null,
  }));
};
let affinitySequence = 0;
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
    const heartId = `affinity-heart-${++affinitySequence}`;
    frame.insertAdjacentHTML('beforeend', `
      <aside class="move-sidebar" aria-label="호감도와 입력 도움말">
        <div class="move-affinity" role="progressbar" aria-label="호감도" aria-valuemin="0" aria-valuemax="100" aria-valuetext="아직 알 수 없음">
          <span class="affinity-caption">호감도</span>
          <div class="affinity-heart">
            <svg viewBox="0 0 100 92" aria-hidden="true">
              <defs><clipPath id="${heartId}"><path d="M50 85C42 78 6 54 6 29C6 5 36 0 50 20C64 0 94 5 94 29C94 54 58 78 50 85Z"/></clipPath></defs>
              <path class="affinity-empty" d="M50 85C42 78 6 54 6 29C6 5 36 0 50 20C64 0 94 5 94 29C94 54 58 78 50 85Z"/>
              <g clip-path="url(#${heartId})"><rect class="affinity-fill" x="0" y="92" width="100" height="0"/></g>
              <path class="affinity-outline" d="M50 85C42 78 6 54 6 29C6 5 36 0 50 20C64 0 94 5 94 29C94 54 58 78 50 85Z"/>
            </svg>
            <strong>— / 100</strong>
            <span class="affinity-sparkle" aria-hidden="true">✦</span>
          </div>
        </div>
        <div class="move-help"><p class="move-hint-caption">대화가 막힐 땐, 이 말들을 참고해 보세요.</p><div class="move-hints" aria-label="입력 도움말"></div></div>
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
    this.affinityMeter = frame.querySelector('.move-affinity');
    this.affinityFill = frame.querySelector('.affinity-fill');
    this.heart = frame.querySelector('.affinity-heart');
    this.sparkle = frame.querySelector('.affinity-sparkle');
    this.previousAffinity = null;
    this.nav = stage.querySelector('.move-nav');
    this.hints = frame.querySelector('.move-hints');
    const composer = stage.querySelector('.move-composer');
    form.hidden = false;
    composer.append(form);
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!input.disabled && !send.disabled && input.value.trim()) form.requestSubmit();
    });
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
    const value = typeof affinity === 'number' && Number.isFinite(affinity) ? Math.max(0, Math.min(100, affinity)) : null;
    if (value !== null && this.previousAffinity !== null && value !== this.previousAffinity &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const increasing = value > this.previousAffinity;
      const glow = increasing ? '#f6ce83' : '#cd7d98';
      for (const node of [this.heart, this.sparkle]) node.getAnimations?.().forEach(animation => animation.cancel());
      this.heart.animate?.([
        {transform:'scale(1)',filter:'drop-shadow(0 5px 6px #100b12aa)'},
        {transform:increasing ? 'scale(1.07)' : 'scale(.96)',filter:`drop-shadow(0 0 14px ${glow})`,offset:.4},
        {transform:'scale(1)',filter:'drop-shadow(0 5px 6px #100b12aa)'},
      ], {duration:700,easing:'ease-out'});
      this.sparkle.animate?.([
        {opacity:0,transform:'translateY(5px) scale(.4)'},
        {opacity:1,transform:'translateY(-2px) scale(1.1)',color:glow,offset:.35},
        {opacity:0,transform:`translateY(${increasing ? -14 : 6}px) scale(.6)`},
      ], {duration:800,easing:'ease-out'});
    }
    this.previousAffinity = value;
    this.affinity.textContent = value === null ? '— / 100' : `${value} / 100`;
    this.affinityFill.setAttribute('y', String(92 * (1 - (value || 0) / 100)));
    this.affinityFill.setAttribute('height', String(92 * (value || 0) / 100));
    this.affinityMeter.setAttribute('aria-valuetext', value === null ? '아직 알 수 없음' : `${value} / 100`);
    if (value === null) this.affinityMeter.removeAttribute('aria-valuenow');
    else this.affinityMeter.setAttribute('aria-valuenow', String(value));
    this.affinity.parentElement.title = '호감도';
    this.nav.replaceChildren();
    for (const slot of postMoveNavigation(locationId, actions)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'move-icon';
      button.setAttribute('aria-label', slot.label);
      button.title = slot.action ? slot.action.label : `${slot.label} · 현재 서버에서 허용되지 않은 이동`;
      button.disabled = busy || !slot.action;
      // Static icon geometry; all variable names/labels use textContent.
      const paths = {
        home: '<path class="icon-enamel" d="M5 11 12 5l7 6v10H5Z"/><path d="m2 11 10-9 10 9M16 5V2h3v6M9 21v-8h6v8M3 22h18M6 10h12"/><path d="M7 13v3m10-3v3"/>',
        steak: '<path class="icon-enamel" d="M16 3c4 0 6 3 5 7-1 3-4 3-6 6s-4 6-8 5-5-4-4-7 4-4 6-6 3-5 7-5Z"/><path d="M16 6c2 0 3 2 2 4s-4 3-6 6-5 3-6 0 3-4 5-6 2-4 5-4Z"/><circle cx="15" cy="9" r="1.5"/><path d="m8 15 2 1m0-5 2 1m-1 6 1-2"/>',
        scissors: '<ellipse class="icon-enamel" cx="6" cy="17.5" rx="3.5" ry="4"/><ellipse class="icon-enamel" cx="18" cy="17.5" rx="3.5" ry="4"/><path d="m8 14 9-12c2 4-1 7-4 10l3 2M16 14 7 2c-2 4 1 7 4 10l-3 2"/><circle cx="12" cy="11" r="1"/>',
        park: '<path class="icon-enamel" d="m2 9 10-6 10 6ZM5 11h14v9H5Z"/><path d="M12 1v2M2 10h20M6 12v7m4-7v7m4-7v7m4-7v7M3 20h18M2 22h20M5 12h14"/>',
        star: '<path class="icon-enamel" d="m12 2 3 6 7 2-5 5 1 7-6-3-6 3 1-7-5-5 7-2Z"/><path d="m12 6 2 5 5 0-4 3 1 5-4-3-4 3 1-5-4-3h5ZM12 9v5"/>',
      };
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[slot.icon]}</svg>`;
      button.addEventListener('click', () => { if (!button.disabled) this.onMove(slot.action.id); });
      this.nav.append(button);
    }
    for (const button of this.hints.children) button.disabled = this.input.disabled || busy;
  }
};
