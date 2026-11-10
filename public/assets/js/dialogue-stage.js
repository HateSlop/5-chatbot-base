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
    window.addEventListener?.('pagehide', () => { ++this.version; this.doorbell?.stop(); });
    if (this.box.ownerDocument) {
      const doc = this.box.ownerDocument;
      this.box.addEventListener('click', event => {
        if (!event.target.closest?.('button')) this.finishTyping();
      });
      this.box.addEventListener('keydown', event => {
        if (event.target === this.box && ['Enter', ' '].includes(event.key) && this.typingTimer) {
          event.preventDefault(); this.finishTyping();
        }
      });
      this.talkCue = doc.createElement('button');
      this.talkCue.type = 'button';
      this.talkCue.className = 'character-talk-cue';
      this.talkCue.textContent = '...';
      this.talkCue.hidden = true;
      root.append(this.talkCue);
      this.talkCue.addEventListener('click', () => this.openDialogue());
      this.figure.addEventListener('click', () => this.openDialogue());
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.positionTalkCue()).observe(root);
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
      this.next.addEventListener('click', () => {
        if (this.typingTimer) return this.finishTyping();
        if (this.pageIndex < this.pages.length - 1) { ++this.pageIndex; this.showPage(); }
        else if (this.root.dataset.dialogueComplete === 'true') this.nextLine?.();
      });
      this.pager.append(this.previous, this.pageLabel, this.next);
      this.controls.append(this.pager);
      this.box.append(this.controls);
      this.pager.hidden = true;
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          if (this.typingTimer && this.box.clientWidth === this.typingWidth && this.box.clientHeight === this.typingHeight) return;
          this.layoutPages();
        });
        observer.observe(this.box); observer.observe(this.controls);
      }
    }
  }
  positionTalkCue() {
    if (!this.talkCue || !this.figure.getBoundingClientRect) return;
    const figure = this.figure.getBoundingClientRect(), root = this.root.getBoundingClientRect();
    this.talkCue.style.left = `${Math.max(38, Math.min(root.width - 38, figure.left - root.left + figure.width * .60))}px`;
    this.talkCue.style.top = `${Math.max(20, Math.min(root.height - 70, figure.top - root.top + 8))}px`;
  }
  openDialogue() {
    if (!this.awaitingSelection || this.root.dataset.loading === 'true') return;
    this.awaitingSelection = false;
    this.selectionOpened = true;
    this.root.dataset.awaitingTalk = 'false';
    if (this.talkCue) this.talkCue.hidden = true;
    this.box.hidden = false;
    const composer = this.root.querySelector('.move-composer');
    if (composer) composer.hidden = false;
    this.layoutPages();
    this.typeCurrentPage();
    this.box.focus?.({preventScroll:true});
    this.resolveOpened?.(true);
  }
  resetSelection() {
    this.finishTyping();
    this.lastTypedText = null;
    this.resolveOpened?.(false);
    this.selectionKey = null;
    this.selectionOpened = false;
    this.awaitingSelection = false;
  }
  finishTyping() {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
      this.text.textContent = this.typingText;
    }
    this.syncProgress();
  }
  syncProgress() {
    const lastPage = !this.pages || this.pageIndex === this.pages.length - 1;
    this.root.dataset.dialogueComplete = String(!this.box.hidden && lastPage && !this.typingTimer);
  }
  typeCurrentPage() {
    const text = this.displayText(this.pages?.[this.pageIndex] ?? this.fullText);
    if (this.typingTimer && this.typingText === text) return;
    this.finishTyping();
    this.text.textContent = text;
    if (this.box.hidden || this.lastTypedText === text) { this.syncProgress(); return; }
    this.lastTypedText = text;
    if (typeof setTimeout !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { this.syncProgress(); return; }
    this.typingText = text;
    this.typingWidth = this.box.clientWidth;
    this.typingHeight = this.box.clientHeight;
    const letters = Array.from(text);
    let count = 0;
    const step = Math.max(1, Math.ceil(letters.length / 100));
    const tick = () => {
      count += step;
      this.text.textContent = letters.slice(0, count).join('');
      this.typingTimer = count < letters.length ? setTimeout(tick, 12) : null;
      this.syncProgress();
    };
    tick();
  }
  showPage(animate = true) {
    this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pages.length - 1));
    this.text.textContent = this.displayText(this.pages[this.pageIndex]);
    this.pageLabel.textContent = `${this.pageIndex + 1} / ${this.pages.length}`;
    this.previous.disabled = this.pageIndex === 0;
    this.next.disabled = this.pageIndex === this.pages.length - 1 && !this.nextLine;
    if (animate) this.typeCurrentPage();
  }
  layoutPages() {
    const partial = this.typingTimer ? this.text.textContent : null;
    const typingText = this.typingText;
    this.measurePages();
    if (partial !== null) {
      if (this.displayText(this.pages?.[this.pageIndex] ?? this.fullText) === typingText) this.text.textContent = partial;
      else { this.lastTypedText = null; this.typeCurrentPage(); }
    }
    this.syncProgress();
  }
  displayText(text) { return (text || '').trim().replace(/\n\s*\n/g, '\n'); }
  measurePages() {
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
    this.text.textContent = this.displayText(this.fullText);
    if (fit()) { this.pages = [this.fullText || '']; this.pageIndex = 0; this.pager.hidden = !this.nextLine; this.showPage(false); return; }
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
        this.text.textContent = this.displayText(characters.slice(start, start + middle).join(''));
        if (fit()) { count = middle; low = middle + 1; }
        else high = middle - 1;
      }
      const page = characters.slice(start, start + count).join('');
      if (page.trim()) pages.push(page);
      else if (pages.length) pages[pages.length - 1] += page;
      start += count;
    }
    this.pages = pages.length ? pages : [''];
    this.showPage(false);
  }
  pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  replaceBackground(background) {
    this.lastBackground = background;
    return this.image(this.background, background, '현재 장소 배경');
  }
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
  render({ background = null, image = null, object = null, speaker = '', text = '', dialogue = true, visitorId = null, sceneId = null, selectCharacter = false, dialogueKey = null, doorbellCount = 1, nextLine = null }) {
    this.nextLine = nextLine;
    if (this.dialogueKey !== dialogueKey) {
      this.finishTyping();
      this.lastTypedText = null;
      this.dialogueKey = dialogueKey;
    }
    const partial = this.typingTimer && this.fullText === text ? this.text.textContent : null;
    if (partial === null) this.finishTyping();
    // Visual selection for an already disclosed server scene, never a progression rule.
    if (sceneId === 'photo_found' && background === '/assets/images/karen_house.svg') background = '/assets/images/karen_secret_room.png';
    if (sceneId === 'photo_found' && /\/karen_/.test(image || '')) image = '/assets/images/karen_angry.png';
    const isHome = background === '/assets/images/player_house.svg';
    const isJimmy = /\/jimmy_(basic|smile|scared|angry|anxiety)\.png$/.test(image || '');
    this.root.dataset.figure = isJimmy ? 'jimmy' : '';
    const visitor = isHome && image && object !== 'tv' ?
      (visitorId || (isJimmy ? 'jimmy' : /\/([a-z]+)[_.-]/.exec(image)?.[1]) || image) : null;
    const arriving = !!visitor && (visitor !== this.homeVisitor || !this.visitorVisible);
    const hadHome = this.paths.get(this.background) === '/assets/images/player_house.svg';
    if (visitor !== this.homeVisitor || !visitor) {
      this.doorbell?.stop();
      this.doorbellReady = null;
    }
    if (visitor !== this.homeVisitor) this.arrivalWait = !!visitor && !hadHome;
    this.homeVisitor = visitor;
    if (!visitor || arriving) this.visitorVisible = false;
    if (!isHome) this.root.removeAttribute?.('data-continuing');
    if (sceneId === 'arrival' && isJimmy && !/\/jimmy_angry\.png$/.test(image || '')) image = '/assets/images/jimmy_smile.png';
    if (['butcher_search', 'empty_butcher'].includes(sceneId) && isJimmy) image = '/assets/images/jimmy_scared.png';
    if (sceneId === 'dinner_invite' && isJimmy) image = '/assets/images/jimmy_anxiety.png';
    if (sceneId === 'empty_butcher') image = null;
    const identity = visitorId || /\/([a-z]+)[_.-]/.exec(image || '')?.[1];
    const selectionKey = selectCharacter && image && object !== 'tv' && identity
      ? `${sceneId || ''}:${background}:${identity}` : null;
    if (selectionKey !== this.selectionKey) {
      this.resetSelection();
      this.selectionKey = selectionKey;
      this.selectionOpened = !!this.skipSelectionOnce;
      this.skipSelectionOnce = false;
      if (selectionKey) this.opened = new Promise(resolve => { this.resolveOpened = resolve; });
    }
    this.awaitingSelection = !!selectionKey && !this.selectionOpened && dialogue;
    this.root.dataset.awaitingTalk = String(this.awaitingSelection);
    if (this.talkCue) {
      this.talkCue.hidden = true;
      this.talkCue.setAttribute('aria-label', `${speaker || '캐릭터'}의 이야기 듣기`);
    }
    if (visitor && !arriving) background = '/assets/images/player_house_open.png';
    if (this.paths.get(this.background) !== background) this.root.dataset.backgroundReady = 'false';
    const version = ++this.version;
    const changedScene = this.lastBackground !== background;
    if (changedScene) this.appearancePending = !!image;
    const continuous = !arriving && this.lastBackground === background && !this.box.hidden;
    const figureVisible = !arriving && this.lastBackground === background && !this.figure.hidden;
    this.lastBackground = background;
    this.root.dataset.loading = continuous || figureVisible ? 'false' : 'true';
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
    this.text.textContent = partial ?? text;
    if (this.fullText !== text) this.pageIndex = 0;
    this.fullText = text;
    this.root.dataset.dialogueComplete = 'false';
    this.box.scrollTop = 0;
    let revealBackground;
    this.backgroundReady = new Promise(resolve => { revealBackground = resolve; });
    this.ready = (async () => {
      if (backgroundReady) await backgroundReady;
      if (background && this.background.decode) await this.background.decode().catch(() => {});
      if (version !== this.version) return false;
      this.root.dataset.backgroundReady = 'true';
      revealBackground(true);
      if (arriving) {
        if (this.arrivalWait) await this.pause(1500);
        if (version !== this.version) return false;
        if (window.Doorbell) {
          this.doorbell ||= new window.Doorbell();
          this.doorbellReady ||= this.doorbell.ring(doorbellCount);
          await this.doorbellReady;
          if (version !== this.version) return false;
        }
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
      if (!arriving && this.appearancePending && sceneId !== 'butcher_search' && !this.awaitingSelection) {
        await this.pause(1000);
        if (version !== this.version) return false;
      }
      this.appearancePending = false;
      this.root.dataset.loading = 'false';
      if (this.displayedFigure !== image) {
        this.angerAnimation?.cancel();
        this.displayedFigure = image;
        if (/\/(jimmy|karen|bob|cathy)_angry\.png$/.test(image || '') &&
            !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          this.angerAnimation = this.figure.animate?.([
            {transform:'translateX(0)'}, {transform:'translateX(-8px)'},
            {transform:'translateX(7px)'}, {transform:'translateX(-5px)'},
            {transform:'translateX(3px)'}, {transform:'translateX(0)'},
          ], {duration:360, easing:'ease-out'});
        }
      }
      if (dialogue && !continuous && !this.awaitingSelection) {
        await this.pause(400);
        if (version !== this.version) return false;
      }
      this.box.hidden = !dialogue || this.awaitingSelection;
      if (composer) composer.hidden = !dialogue || this.awaitingSelection;
      if (this.talkCue) {
        this.talkCue.hidden = !this.awaitingSelection;
        this.positionTalkCue();
      }
      if (!this.awaitingSelection) this.resolveOpened?.(true);
      this.layoutPages();
      if (!this.box.hidden) this.typeCurrentPage();
      return true;
    })().finally(() => revealBackground(false));
    if (!selectionKey) this.opened = this.ready;
  }
};
