// The server selects the ending; this component presents its four supplied panels.
window.escapeComic = new class {
  constructor() {
    this.root = document.getElementById('escape-screen');
    this.description = document.getElementById('escape-description');
    this.images = [...this.root.querySelectorAll('img')];
    this.version = 0;
    window.addEventListener('pagehide', () => this.show(false));
  }
  async show(active, text = '', gender = null) {
    if (!active) {
      if (this.finishTimer) clearTimeout(this.finishTimer);
      ++this.version;
      this.active = false;
      this.gender = null;
      this.root.hidden = true;
      this.root.classList.remove('is-playing');
      return;
    }
    const selectedGender = gender === 'female' ? 'female' : 'male';
    if (this.active && this.gender === selectedGender) return;
    this.active = true;
    this.gender = selectedGender;
    this.root.classList.remove('is-playing');
    const version = ++this.version;
    this.description.textContent = text;
    this.root.dataset.loading = 'true';
    for (const img of this.images) img.src = img.dataset[`${selectedGender}Src`];
    this.root.hidden = false;
    await Promise.all(this.images.map(img => img.decode?.().catch(() => {})));
    if (!this.active || version !== this.version) return;
    this.root.dataset.loading = 'false';
    this.root.classList.add('is-playing');
    this.root.focus();
    if (window.endingCinema) this.finishTimer = setTimeout(() => {
      if (this.active && version === this.version) window.endingCinema.finish();
    }, 6500);
  }
}();
