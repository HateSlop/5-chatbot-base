// Uses only the location and ending already disclosed by the server.
window.locationMusic = new class {
  constructor() {
    this.audio = document.getElementById('location-music');
    this.button = document.getElementById('location-music-toggle');
    this.tracks = {butcher_shop:'butcher',salon:'salon',square:'square',player_house:'home',karen_house:'karen'};
    this.enabled = true;
    this.audio.volume = .4;
    this.button.addEventListener('click', () => { this.enabled = !this.enabled; this.sync(); });
    document.addEventListener('visibilitychange', () => this.sync());
    for (const event of ['pointerdown','keydown']) document.addEventListener(event, input => {
      if (input.target.closest('#location-music-toggle')) return;
      if (event === 'keydown' && !['Enter',' '].includes(input.key)) return;
      if (this.enabled) this.sync();
    });
    window.addEventListener('pagehide', () => { this.track = null; this.audio.pause(); this.audio.currentTime = 0; });
    this.updateButton();
  }
  updateButton() {
    const label = this.enabled ? '배경음악 음소거' : '배경음악 켜기';
    this.button.setAttribute('aria-label', label);
    this.button.setAttribute('aria-pressed', String(this.enabled));
    this.button.title = label;
  }
  enter(location, ending = null, sceneId = null) {
    const darkButcher = ['butcher_search', 'empty_butcher', 'basement_entry', 'basement', 'bob_caught'].includes(sceneId);
    const afterBasement = ['dinner_invite', 'wait_dinner', 'karen_dinner', 'checkpoint', 'job_choice', 'job_result', 'festival_invite', 'festival', 'hair_found', 'final_choice'].includes(sceneId);
    const track = ending ? null : darkButcher ? 'frightened-jimmy' : sceneId === 'photo_found' ? 'urgent' : afterBasement ? 'after-basement' : sceneId === 'cathy_help' ? 'cathy-minigame' : this.tracks[location] || null;
    this.button.hidden = !!ending;
    if (track !== this.track) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.track = track;
      if (track) this.audio.src = `/assets/audio/${track}-bgm.mp3`;
      else this.audio.removeAttribute('src');
    }
    this.sync();
  }
  sync() {
    this.updateButton();
    if (!this.enabled || !this.track || document.hidden) { this.audio.pause(); return; }
    if (!this.audio.paused) return;
    this.audio.play().then(() => {
      if (!this.enabled || !this.track || document.hidden) this.audio.pause();
    }).catch(() => {}); // Audible autoplay retries on the next user gesture.
  }
}();
