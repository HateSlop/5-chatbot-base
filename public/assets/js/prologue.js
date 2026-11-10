// Pre-session narration only. Leaving the page cancels every pending line.
window.Prologue = class {
  constructor(root) {
    this.root = root;
    this.copy = root.querySelector('.prologue-copy');
    this.spoken = root.querySelector('.prologue-spoken');
    this.lines = [...this.copy.querySelectorAll('p')];
    this.texts = this.lines.map(line => line.textContent);
    if (typeof Audio !== 'undefined') {
      this.sound = new Audio('/assets/audio/monologue-typing.wav');
      this.sound.loop = true;
      this.sound.volume = .3;
    }
    root.querySelector('button').addEventListener('click', () => this.finish());
    window.addEventListener('pagehide', () => this.cancel());
    document.addEventListener('visibilitychange', () => this.syncSound());
    document.getElementById('location-music-toggle')?.addEventListener('click', () => this.syncSound());
    for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => this.syncSound());
  }
  syncSound() {
    if (!this.sound) return;
    if (!this.typing || document.hidden || window.locationMusic?.enabled === false) this.sound.pause();
    else if (this.sound.paused) this.sound.play().catch(() => {});
  }
  play() {
    this.cancel();
    this.finishing = false;
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.root.classList.remove('is-leaving');
    this.lines.forEach((line, index) => { line.hidden = true; line.textContent = this.texts[index]; });
    this.copy.scrollTop = 0;
    this.root.hidden = false;
    this.root.focus({preventScroll:true});
    const ready = new Promise(resolve => { this.resolve = resolve; });
    let index = 0;
    const next = () => {
      if (index === this.lines.length) return this.finish();
      const line = this.lines[index];
      const letters = Array.from(this.texts[index++]);
      if (this.spoken) this.spoken.textContent = letters.join('');
      line.hidden = false;
      if (this.reduced) {
        this.copy.scrollTop = this.copy.scrollHeight;
        this.timer = setTimeout(next, Math.max(2000, letters.length * 50));
        return;
      }
      line.textContent = '';
      this.typing = true;
      this.syncSound();
      let count = 0;
      const tick = () => {
        if (document.hidden) { this.timer = setTimeout(tick, 100); return; }
        line.textContent = letters.slice(0, ++count).join('');
        this.copy.scrollTop = this.copy.scrollHeight;
        if (count < letters.length) this.timer = setTimeout(tick, ',.!?…'.includes(letters[count - 1]) ? 180 : 45);
        else {
          this.typing = false;
          this.syncSound();
          this.timer = setTimeout(next, 1500);
        }
      };
      tick();
    };
    next();
    return ready;
  }
  finish() {
    if (!this.resolve || this.finishing) return;
    this.finishing = true;
    clearTimeout(this.timer);
    this.typing = false;
    this.syncSound();
    this.root.classList.add('is-leaving');
    this.timer = setTimeout(() => {
      this.root.hidden = true;
      this.resolve?.(true);
      this.resolve = null;
    }, this.reduced ? 0 : 800);
  }
  cancel() {
    clearTimeout(this.timer);
    this.typing = false;
    this.syncSound();
    if (this.sound) this.sound.currentTime = 0;
    this.root.hidden = true;
    this.resolve?.(false);
    this.resolve = null;
  }
};
