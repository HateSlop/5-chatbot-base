// Presentation only: ending type and location changes come from the server.
window.sceneEffects = new class {
  constructor() {
    this.curtain = document.getElementById('scene-curtain');
    this.screen = document.getElementById('death-screen');
    this.video = document.getElementById('death-video');
    this.status = document.getElementById('death-status');
    this.controls = document.getElementById('death-controls');
    this.replay = document.getElementById('death-replay');
    this.game = document.getElementById('game-screen');
    this.replay.addEventListener('click', () => { this.video.currentTime = 0; this.play(); });
    document.getElementById('death-restart').addEventListener('click', () => window.location.reload());
    this.video.addEventListener('ended', () => { this.controls.hidden = false; this.status.textContent = '이야기가 끝났습니다.'; this.replay.focus(); });
    this.video.addEventListener('error', () => { this.controls.hidden = false; this.status.textContent = '영상을 불러오지 못했습니다. 다시 재생하거나 새로 시작해 주세요.'; });
    window.addEventListener('pagehide', () => { this.video.pause(); });
  }
  async transition(show) {
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
      await show();
      await fade(1, 0);
    } finally { this.curtain.hidden = true; }
  }
  async play() {
    this.controls.hidden = true;
    this.status.textContent = '';
    try { await this.video.play(); }
    catch { this.controls.hidden = false; this.status.textContent = '재생 버튼을 눌러 엔딩 영상을 시작해 주세요.'; }
  }
  ending(type, text = '') {
    const death = type === 'death';
    if (!death) {
      if (this.active) { this.video.pause(); this.video.currentTime = 0; }
      this.active = false;
      this.screen.hidden = true;
      this.game.inert = false;
      return;
    }
    document.getElementById('death-description').textContent = text;
    if (this.active) return;
    this.active = true;
    this.screen.hidden = false;
    this.game.inert = true;
    this.screen.focus();
    this.play();
  }
}();
