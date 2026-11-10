// Presentation only: ending type and location changes come from the server.
window.sceneEffects = new class {
  constructor() {
    this.curtain = document.getElementById('scene-curtain');
    this.datePanel = document.getElementById('scene-date-transition');
    this.screen = document.getElementById('death-screen');
    this.video = document.getElementById('death-video');
    this.status = document.getElementById('death-status');
    this.controls = document.getElementById('death-controls');
    this.replay = document.getElementById('death-replay');
    this.game = document.getElementById('game-screen');
    this.assimilationScreen = document.getElementById('assimilation-screen');
    this.replay.addEventListener('click', () => { this.video.currentTime = 0; this.play(); });
    document.getElementById('death-restart').addEventListener('click', () => window.location.reload());
    this.video.addEventListener('ended', () => { this.controls.hidden = false; this.status.textContent = ''; this.replay.focus(); });
    this.video.addEventListener('error', () => { this.controls.hidden = false; this.status.textContent = '영상을 불러오지 못했습니다. 다시 재생하거나 새로 시작해 주세요.'; });
    window.addEventListener('pagehide', () => { this.active = false; window.butcherScare?.reset(); this.video.pause(); });
  }
  async transition(show, dates = null) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fade = async (from, to) => {
      if (!reduced && this.curtain.animate) {
        await this.curtain.animate([{opacity:from}, {opacity:to}], {duration:180, easing:'ease-in-out'}).finished;
      }
      this.curtain.style.opacity = String(to);
    };
    this.curtain.hidden = false;
    this.curtain.style.opacity = '0';
    try {
      await fade(0, 1);
      if (dates && this.datePanel) {
        const oldDate = String(dates.from).split('.');
        const newDate = String(dates.to).split('.');
        const base = document.getElementById('scene-date-base');
        const newBase = `${newDate[0]}.${newDate[1]}.`;
        base.textContent = reduced ? newBase : `${oldDate[0]}.${oldDate[1]}.`;
        document.getElementById('scene-date-old').textContent = oldDate[2];
        document.getElementById('scene-date-new').textContent = newDate[2];
        this.datePanel.hidden = false;
        this.datePanel.classList.remove('is-turning');
        void this.datePanel.offsetWidth;
        this.datePanel.classList.add('is-turning');
        if (!reduced) await new Promise(resolve => setTimeout(resolve, 1250));
        base.textContent = newBase;
      }
      await show();
      await fade(1, 0);
    } finally { this.curtain.hidden = true; if (this.datePanel) this.datePanel.hidden = true; }
  }
  async play() {
    this.controls.hidden = true;
    this.status.textContent = '';
    try { await this.video.play(); }
    catch { this.controls.hidden = false; this.status.textContent = '재생 버튼을 눌러 엔딩 영상을 시작해 주세요.'; }
  }
  ending(type, text = '', gender = null, locationId = null) {
    if (!type) window.endingCinema?.reset();
    window.endingCinema?.show(type === 'assimilation', gender);
    window.escapeComic?.show(type === 'escape', text, gender);
    if (type !== 'assimilation') {
      if (this.assimilationTimer) clearTimeout(this.assimilationTimer);
      this.assimilationActive = false;
      if (this.assimilationScreen) this.assimilationScreen.hidden = true;
    } else if (!this.assimilationActive && this.assimilationScreen) {
      this.assimilationActive = true;
      this.assimilationScreen.hidden = false;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (typeof setTimeout === 'function') this.assimilationTimer = setTimeout(() => window.location?.assign?.('/?autostart=1'), reduced ? 700 : 2100);
    }
    const death = type === 'death';
    if (!death) {
      window.butcherScare?.reset();
      if (this.active) { this.video.pause(); this.video.currentTime = 0; }
      this.active = false;
      this.screen.hidden = true;
      this.game.inert = type === 'assimilation' || type === 'escape' && !!window.escapeComic;
      return;
    }
    document.getElementById('death-description').textContent = text;
    if (this.active) return;
    this.active = true;
    this.screen.hidden = false;
    this.game.inert = true;
    this.screen.focus();
    const source = gender === 'male' ? this.video.dataset.maleSrc : this.video.dataset.femaleSrc;
    if (!source) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.hidden = true;
      this.replay.hidden = true;
      this.controls.hidden = false;
      this.status.textContent = '선택한 주인공의 엔딩 영상은 준비 중입니다.';
      return;
    }
    this.video.src = source;
    this.video.hidden = false;
    this.replay.hidden = false;
    if (locationId === 'butcher_shop' && window.butcherScare) {
      window.butcherScare.play().then(finished => { if (finished && this.active) this.play(); });
    } else this.play();
  }
}();
