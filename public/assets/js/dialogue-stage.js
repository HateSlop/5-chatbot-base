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
    this.requests = new WeakMap();
    this.version = 0;
    this.homeVisitor = null;
    this.visitorVisible = false;
    this.pageIndex = 0;
    if (this.box.ownerDocument) {
      const doc = this.box.ownerDocument;
      this.copy = doc.createElement('div');
      this.copy.className = 'dialogue-copy';
      this.copy.append(this.speaker, this.text);
      this.box.append(this.copy);
      this.controls = doc.createElement('div');
      this.controls.className = 'dialogue-controls';
      for (const button of this.box.querySelectorAll('.dialogue-advance')) this.controls.append(button);
      this.pager = doc.createElement('nav');
      this.pager.className = 'dialogue-pages';
      this.pager.setAttribute('aria-label', '대사 페이지');
      this.previous = doc.createElement('button');
      this.next = doc.createElement('button');
      this.pageLabel = doc.createElement('span');
      this.previous.type = this.next.type = 'button';
      this.previous.textContent = '◀'; this.next.textContent = '▶';
      this.previous.setAttribute('aria-label', '이전 대사');
      this.next.setAttribute('aria-label', '다음 대사');
      this.pageLabel.className = 'visually-hidden';
      this.previous.addEventListener('click', () => { --this.pageIndex; this.showPage(); });
      this.next.addEventListener('click', () => { ++this.pageIndex; this.showPage(); });
      this.pager.append(this.previous, this.pageLabel, this.next);
      this.controls.append(this.pager);
      this.box.append(this.controls);
      this.pager.hidden = true;
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.layoutPages());
        observer.observe(this.box); observer.observe(this.controls);
      }
    }
  }
  showPage() {
    this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pages.length - 1));
    this.text.textContent = this.pages[this.pageIndex];
    this.pageLabel.textContent = `${this.pageIndex + 1} / ${this.pages.length}`;
    this.previous.disabled = this.pageIndex === 0;
    this.next.disabled = this.pageIndex === this.pages.length - 1;
  }
  layoutPages() {
    if (!this.pager || !this.box.clientHeight || this.box.hidden) return;
    this.box.classList.remove('is-paged');
    this.pager.hidden = true;
    const viewport = this.copy || this.box;
    const fit = () => viewport.scrollHeight <= viewport.clientHeight;
    const reserve = () => {
      if (!this.copy) return;
      const status = this.box.querySelector('.status-message');
      this.box.style.minHeight = `${Math.max(112, (this.controls?.offsetHeight || 0) + (status?.offsetHeight || 0) + 76)}px`;
    };
    reserve();
    this.text.textContent = this.fullText || '';
    if (fit()) { this.pages = [this.fullText || '']; return; }
    this.box.classList.add('is-paged');
    this.pager.hidden = false;
    reserve();
    const characters = Array.from(this.fullText || '');
    const pages = [];
    let start = 0;
    while (start < characters.length) {
      let low = 1, high = characters.length - start, count = 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        this.text.textContent = characters.slice(start, start + middle).join('');
        if (fit()) { count = middle; low = middle + 1; }
        else high = middle - 1;
      }
      pages.push(characters.slice(start, start + count).join(''));
      start += count;
    }
    this.pages = pages.length ? pages : [''];
    this.showPage();
  }
  pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  image(node, path, alt) {
    if (this.paths.get(node) === (path || null)) return this.requests.get(node);
    this.paths.set(node, path || null);
    this.requests.delete(node);
    // Decode a replacement off-screen while the current image stays visible.
    if (path && typeof Image !== 'undefined') {
      const pending = new Image();
      const request = new Promise(resolve => {
        pending.onload = async () => {
          if (pending.decode) await pending.decode().catch(() => {});
          if (this.paths.get(node) !== path) return resolve(false);
          node.src = path;
          node.alt = alt || '';
          node.hidden = false;
          if (node === this.background) this.root.dataset.backgroundReady = 'true';
          resolve(true);
        };
        pending.onerror = () => {
          if (this.paths.get(node) === path && !node.getAttribute('src')) node.hidden = true;
          resolve(false);
        };
        pending.src = path;
      });
      this.requests.set(node, request);
      return request;
    }
    node.hidden = true;
    node.onload = () => {
      node.hidden = false;
      if (node === this.background) this.root.dataset.backgroundReady = 'true';
    };
    node.onerror = () => { node.hidden = true; };
    node.alt = alt || '';
    if (path) node.src = path;
    else { node.onload = null; node.removeAttribute('src'); }
  }
  async depart(shake) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !this.figure.animate) return;
    const frames = shake ? [
      {transform:'translateX(0)',opacity:1},
      {transform:'translateX(-5px)',offset:.12}, {transform:'translateX(5px)',offset:.24},
      {transform:'translateX(-5px)',offset:.36}, {transform:'translateX(4px)',offset:.48},
      {transform:'translateX(0)',opacity:0},
    ] : [{opacity:1}, {opacity:0}];
    const animation = this.figure.animate(frames, {duration:shake ? 1100 : 650,easing:'ease-in',fill:'forwards'});
    await animation.finished.catch(() => {});
    this.figure.hidden = true;
    animation.cancel();
  }
  render({ background = null, image = null, object = null, speaker = '', text = '', dialogue = true, visitorId = null, sceneId = null }) {
    // Visual selection for an already disclosed server scene, never a progression rule.
    if (sceneId === 'photo_found' && background === '/assets/images/karen_house.svg') background = '/assets/images/karen_secret_room_angle2.png';
    const legacyKaren = /\/karen_(neutral|smile|worried)\.svg$/.exec(image || '');
    if (legacyKaren) image = legacyKaren[1] === 'smile' ? '/assets/images/karen_smile.png' : '/assets/images/karen_basic.png';
    if (sceneId === 'photo_found' && /\/karen_/.test(image || '')) image = '/assets/images/karen_angry.png';
    const isHome = background === '/assets/images/player_house.svg';
    const legacyJimmy = /\/jimmy_(neutral|smile|worried)\.svg$/.exec(image || '');
    const isJimmy = !!legacyJimmy || /\/jimmy(?:_(basic|smile|scared|angry|anxiety))?\.png$/.test(image || '');
    this.root.dataset.figure = isJimmy ? 'jimmy' : '';
    const visitor = isHome && image && object !== 'tv' ?
      (visitorId || (isJimmy ? 'jimmy' : /\/([a-z]+)[_.-]/.exec(image)?.[1]) || image) : null;
    const arriving = !!visitor && (visitor !== this.homeVisitor || !this.visitorVisible);
    const hadHome = this.paths.get(this.background) === '/assets/images/player_house.svg';
    if (visitor !== this.homeVisitor) this.arrivalWait = !!visitor && !hadHome;
    this.homeVisitor = visitor;
    if (!visitor || arriving) this.visitorVisible = false;
    if (!isHome) this.root.removeAttribute?.('data-continuing');
    if (legacyJimmy) image = `/assets/images/jimmy_${({neutral:'basic',smile:'smile',worried:'scared'})[legacyJimmy[1]]}.png`;
    if (['butcher_search', 'empty_butcher'].includes(sceneId) && isJimmy) image = '/assets/images/jimmy_scared.png';
    if (sceneId === 'dinner_invite' && isJimmy) image = '/assets/images/jimmy_anxiety.png';
    if (sceneId === 'empty_butcher') image = null;
    if (visitor && !arriving) background = '/assets/images/player_house_open.png';
    if (this.paths.get(this.background) !== background) this.root.dataset.backgroundReady = 'false';
    const version = ++this.version;
    const changedScene = this.lastBackground !== background;
    if (changedScene) this.appearancePending = !!image;
    const continuous = !arriving && this.lastBackground === background && !this.box.hidden;
    this.lastBackground = background;
    this.root.dataset.loading = continuous ? 'false' : 'true';
    this.root.dataset.simultaneous = String(sceneId === 'butcher_search');
    const composer = this.root.querySelector('.move-composer');
    if (!continuous || !dialogue) this.box.hidden = true;
    if (composer && (!continuous || !dialogue)) composer.hidden = true;
    const backgroundReady = this.image(this.background, background, '현재 장소 배경');
    const figureReady = this.image(this.figure, arriving ? null : image, object === 'tv' ? 'TV' : `${speaker}의 현재 모습`);
    this.tv.hidden = object !== 'tv' || !!image;
    // If a replacement TV asset fails, keep the CSS fallback available.
    this.figure.onerror = () => { this.figure.hidden = true; this.tv.hidden = object !== 'tv'; };
    this.speaker.textContent = speaker ? `${speaker}: ` : '';
    this.text.textContent = text;
    if (this.fullText !== text) this.pageIndex = 0;
    this.fullText = text;
    this.box.scrollTop = 0;
    this.ready = (async () => {
      if (backgroundReady) await backgroundReady;
      if (background && this.background.decode) await this.background.decode().catch(() => {});
      if (version !== this.version) return false;
      this.root.dataset.backgroundReady = 'true';
      if (arriving) {
        if (this.arrivalWait) await this.pause(1500);
        if (version !== this.version) return false;
        await this.image(this.background, '/assets/images/player_house_open.png', '문이 열린 집');
        if (version !== this.version) return false;
        this.lastBackground = '/assets/images/player_house_open.png';
        if (this.background.decode) await this.background.decode().catch(() => {});
        if (version !== this.version) return false;
        await this.pause(1000);
        if (version !== this.version) return false;
        await this.image(this.figure, image, speaker ? `${speaker}의 현재 모습` : '방문 인물');
        if (version !== this.version) return false;
        this.visitorVisible = true;
        this.arrivalWait = false;
      }
      if (figureReady) await figureReady;
      if (image && this.figure.decode) await this.figure.decode().catch(() => {});
      if (version !== this.version) return false;
      if (!arriving && this.appearancePending && sceneId !== 'butcher_search') {
        await this.pause(1000);
        if (version !== this.version) return false;
      }
      this.appearancePending = false;
      this.root.dataset.loading = 'false';
      if (this.displayedFigure !== image) {
        this.angerAnimation?.cancel();
        const previous = /\/(jimmy|karen|bob|cathy)_(basic|neutral|smile)\.(png|svg)$/.exec(this.displayedFigure || '');
        this.displayedFigure = image;
        if (previous && image === `/assets/images/${previous[1]}_angry.png` &&
            !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          this.angerAnimation = this.figure.animate?.([
            {transform:'translateX(0)'}, {transform:'translateX(-8px)'},
            {transform:'translateX(7px)'}, {transform:'translateX(-5px)'},
            {transform:'translateX(3px)'}, {transform:'translateX(0)'},
          ], {duration:360, easing:'ease-out'});
        }
      }
      if (dialogue && !continuous) {
        await this.pause(400);
        if (version !== this.version) return false;
      }
      this.box.hidden = !dialogue;
      if (composer) composer.hidden = !dialogue;
      this.layoutPages();
      return true;
    })();
  }
};
