/* Presentation only: no story decisions, API calls or persistent state. */
window.DialogueStage = class {
  constructor(root) {
    this.root = root;
    this.background = root.querySelector('.dialogue-background');
    this.figure = root.querySelector('.dialogue-figure');
    this.tv = root.querySelector('.dialogue-tv');
    this.speaker = root.querySelector('.dialogue-speaker');
    this.text = root.querySelector('.dialogue-text');
    this.box = root.querySelector('.dialogue-box');
    this.paths = new WeakMap();
    this.version = 0;
    this.homeJimmy = false;
  }
  pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  image(node, path, alt) {
    if (this.paths.get(node) === (path || null)) return;
    this.paths.set(node, path || null);
    node.hidden = true;
    node.onload = () => { node.hidden = false; };
    node.onerror = () => { node.hidden = true; };
    node.alt = alt || '';
    if (path) node.src = path;
    else { node.onload = null; node.removeAttribute('src'); }
  }
  render({ background = null, image = null, object = null, speaker = '', text = '', dialogue = true }) {
    const isHome = background === '/assets/images/player_house.svg';
    const isJimmy = /\/jimmy_(neutral|smile|worried)\.svg$/.test(image || '') || image === '/assets/images/jimmy.png';
    const arriving = isHome && isJimmy && !this.homeJimmy;
    const hadHome = this.paths.get(this.background) === '/assets/images/player_house.svg';
    this.homeJimmy = isHome && isJimmy;
    if (isJimmy) image = '/assets/images/jimmy.png';
    if (this.homeJimmy && !arriving) background = '/assets/images/player_house_open.png';
    const version = ++this.version;
    this.root.dataset.loading = 'true';
    const composer = this.root.querySelector('.move-composer');
    this.box.hidden = true;
    if (composer) composer.hidden = true;
    this.image(this.background, background, '현재 장소 배경');
    this.image(this.figure, arriving ? null : image, object === 'tv' ? 'TV' : `${speaker}의 현재 모습`);
    this.tv.hidden = object !== 'tv' || !!image;
    // If a replacement TV asset fails, keep the CSS fallback available.
    this.figure.onerror = () => { this.figure.hidden = true; this.tv.hidden = object !== 'tv'; };
    this.speaker.textContent = speaker ? `${speaker}: ` : '';
    this.text.textContent = text;
    this.box.scrollTop = 0;
    this.ready = (async () => {
      if (background && this.background.decode) await this.background.decode().catch(() => {});
      if (version !== this.version) return false;
      if (arriving) {
        if (!hadHome) await this.pause(3000);
        if (version !== this.version) return false;
        this.image(this.background, '/assets/images/player_house_open.png', '문이 열린 집');
        if (this.background.decode) await this.background.decode().catch(() => {});
        if (version !== this.version) return false;
        await this.pause(500);
        if (version !== this.version) return false;
        this.image(this.figure, image, '지미');
      }
      if (image && this.figure.decode) await this.figure.decode().catch(() => {});
      if (version !== this.version) return false;
      this.root.dataset.loading = 'false';
      if (arriving) {
        await this.pause(400);
        if (version !== this.version) return false;
      }
      this.box.hidden = !dialogue;
      if (composer) composer.hidden = !dialogue;
      return true;
    })();
  }
};
