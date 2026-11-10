// The server selects the ending; this component presents its four supplied panels.
window.escapeComic = new class {
  constructor() {
    this.root = document.getElementById('escape-screen');
    this.description = document.getElementById('escape-description');
    this.version = 0;
    window.addEventListener('pagehide', () => this.show(false));
  }
  async show(active, text = '') {
    if (!active) {
      ++this.version;
      this.active = false;
      this.root.hidden = true;
      this.root.classList.remove('is-playing');
      return;
    }
    if (this.active) return;
    this.active = true;
    const version = ++this.version;
    this.description.textContent = text;
    this.root.dataset.loading = 'true';
    this.root.hidden = false;
    await Promise.all([...this.root.querySelectorAll('img')].map(img => img.decode?.().catch(() => {})));
    if (!this.active || version !== this.version) return;
    this.root.dataset.loading = 'false';
    this.root.classList.add('is-playing');
    this.root.focus();
  }
}();
