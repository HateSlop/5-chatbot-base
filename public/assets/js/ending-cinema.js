// These scenes only present endings already chosen by the server.
window.endingCinema = new class {
  constructor() {
    this.root = document.getElementById('ending-cinema');
    this.opening = this.root.querySelector('.cinema-opening');
    this.room = this.root.querySelector('.cinema-room');
    this.cover = this.root.querySelector('.cinema-black');
    this.cursor = this.root.querySelector('.cinema-cursor');
    this.finale = this.root.querySelector('.cinema-finale');
    this.stage = new DialogueStage(this.root.querySelector('.cinema-stage'));
    this.video = this.opening.querySelector('video');
    this.version = 0;
    this.waits = new Map();
    window.addEventListener('pagehide', () => this.reset());
  }
  reset() {
    ++this.version;
    for (const [timer, resolve] of this.waits) { clearTimeout(timer); resolve(); }
    this.waits.clear();
    for (const animation of this.root.getAnimations({subtree:true})) animation.cancel();
    this.stage.resetSelection();
    ++this.stage.version;
    this.stage.doorbell?.stop();
    this.video.pause();
    this.active = this.finishing = false;
    this.root.hidden = true;
    this.opening.hidden = this.room.hidden = this.cursor.hidden = this.finale.hidden = true;
    this.finale.classList.remove('is-lit');
    this.root.querySelector('.cinema-return').hidden = true;
    this.cover.style.opacity = '0';
  }
  wait(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.waits.delete(timer); resolve(); }, ms);
      this.waits.set(timer, resolve);
    });
  }
  async animate(node, frames, duration) {
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      await node.animate(frames, {duration, easing:'ease-in-out', fill:'forwards'}).finished.catch(() => {});
    }
    Object.assign(node.style, frames.at(-1));
  }
  async fade(show, run) {
    await this.animate(this.cover, [{opacity:0}, {opacity:1}], 1800);
    if (run !== this.version) return;
    await show();
    if (run !== this.version) return;
    await this.animate(this.cover, [{opacity:1}, {opacity:0}], 1600);
  }
  async read(run) {
    if (await this.stage.ready === false || run !== this.version) return;
    while (run === this.version) {
      await this.wait(120);
      if (run !== this.version) return;
      if (this.stage.typingTimer) continue;
      await this.wait(2500);
      if (run !== this.version) return;
      if (this.stage.pageIndex >= this.stage.pages.length - 1) return;
      ++this.stage.pageIndex;
      this.stage.showPage();
    }
  }
  async show(active, gender) {
    if (!active) { if (this.active && !this.finishing) this.reset(); return; }
    if (this.active) return;
    this.reset();
    this.active = true;
    const run = this.version;
    this.root.hidden = false;
    this.root.focus();
    this.room.hidden = false;
    this.stage.render({background:'/assets/images/festival_stares.png', text:'어라.. 생각보다 맛이 괜찮네?'});
    await this.read(run);
    if (run !== this.version) return;
    await this.fade(async () => {
      this.room.hidden = true;
      this.opening.hidden = false;
      await this.video.play().catch(() => {});
    }, run);
    if (run !== this.version) return;
    this.cursor.hidden = false;
    const target = this.root.querySelector('.cinema-start').getBoundingClientRect();
    const origin = this.root.getBoundingClientRect();
    await this.animate(this.cursor, [
      {left:'80%', top:'32%'},
      {left:`${target.left - origin.left + target.width * .55}px`, top:`${target.top - origin.top + target.height * .48}px`},
    ], 2200);
    if (run !== this.version) return;
    await this.animate(this.cursor, [{transform:'scale(1)'}, {transform:'scale(.8)'}, {transform:'scale(1)'}], 320);
    if (run !== this.version) return;
    await this.fade(async () => {
      this.cursor.hidden = this.opening.hidden = true;
      this.video.pause();
      this.room.hidden = false;
      this.stage.render({background:'/assets/images/player_house.svg', text:'드디어 이사를 왔네, 여기 사람들은 어떨까?'});
      await this.stage.backgroundReady;
    }, run);
    if (run !== this.version) return;
    await this.read(run);
    if (run !== this.version) return;
    // Reuse the original arrival's doorbell, open door, delay and figure placement.
    this.stage.render({background:'/assets/images/player_house.svg',
      image:`/assets/images/character_user_${gender === 'female' ? 'girl' : 'boy'}.png`,
      visitorId:'assimilated-player', speaker:'', text:'어서와 더뉴빌리지에 온 거를 환영해!'});
    await this.read(run);
    if (run === this.version) await this.finish();
  }
  async finish() {
    if (this.finishing) return;
    this.finishing = true;
    const run = this.version;
    this.root.hidden = false;
    this.root.focus();
    await this.animate(this.cover, [{opacity:0}, {opacity:1}], 2400);
    if (run !== this.version) return;
    this.video.pause();
    this.room.hidden = this.opening.hidden = this.cursor.hidden = true;
    this.finale.hidden = false;
    this.cover.style.opacity = '0';
    this.cover.getAnimations().forEach(animation => animation.cancel());
    this.finale.classList.add('is-lit');
    await this.wait(7800);
    if (run !== this.version) return;
    this.root.querySelector('.cinema-return').hidden = false;
  }
}();
