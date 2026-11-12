// Plays only after the server confirms death in the butcher shop.
window.butcherScare = new class {
  constructor() {
    this.root = document.getElementById('butcher-scare');
    this.sound = document.getElementById('butcher-lunge-sound');
    this.sound.volume = .6;
    this.images = [...this.root.querySelectorAll('img')];
    this.version = 0;
    this.waits = new Map();
    window.addEventListener('pagehide', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopSound(); });
  }
  stopSound() {
    this.sound.pause();
    this.sound.currentTime = 0;
  }
  reset() {
    ++this.version;
    this.stopSound();
    for (const [timer, resolve] of this.waits) { clearTimeout(timer); resolve(); }
    this.waits.clear();
    this.root.hidden = true;
    this.root.dataset.phase = '';
  }
  pause(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.waits.delete(timer); resolve(); }, ms);
      this.waits.set(timer, resolve);
    });
  }
  async play() {
    this.reset();
    const run = this.version;
    try {
      // Prepare both poses before the blackout so the sudden reveal cannot wait on a download.
      await Promise.all(this.images.map(img => img.decode?.()));
      if (run !== this.version) return false;
      this.root.dataset.phase = 'arrival';
      this.root.hidden = false;
      this.root.focus();
      await this.pause(2400);
      if (run !== this.version) return false;
      this.root.dataset.phase = 'black';
      await this.pause(850);
      if (run !== this.version) return false;
      this.root.dataset.phase = 'attack';
      if (!document.hidden && window.locationMusic?.enabled !== false) this.sound.play().catch(() => {});
      await this.pause(1500);
      if (run !== this.version) return false;
      this.stopSound();
      this.root.dataset.phase = 'fade';
      await this.pause(650);
      return run === this.version;
    } catch {
      // A failed image must still allow the existing death film to play.
      return run === this.version;
    } finally {
      if (run === this.version) this.root.hidden = true;
    }
  }
}();
