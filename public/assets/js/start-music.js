const startMusic = document.getElementById('start-music');
const startVideo = document.querySelector('.start-video');
const musicToggle = document.getElementById('start-music-toggle');
let wantsMusic = true;

function updateMusicButton() {
  const label = wantsMusic ? '음소거' : '음악 켜기';
  musicToggle.setAttribute('aria-label', label);
  musicToggle.title = label;
  musicToggle.setAttribute('aria-pressed', String(wantsMusic));
}

function syncStartMusic() {
  if (!wantsMusic || startVideo.paused || document.hidden) {
    startMusic.pause();
    updateMusicButton();
    return;
  }
  // Browsers may require a user gesture before playing audible media.
  startMusic.play().then(() => {
    if (!wantsMusic || document.hidden || startVideo.paused) startMusic.pause();
    updateMusicButton();
  }).catch(updateMusicButton);
}

musicToggle.addEventListener('click', () => {
  wantsMusic = !wantsMusic;
  syncStartMusic();
});
for (const event of ['playing', 'pause']) startVideo.addEventListener(event, syncStartMusic);
document.addEventListener('visibilitychange', syncStartMusic);
for (const event of ['pointerdown', 'keydown']) {
  document.addEventListener(event, input => {
    if (input.target.closest('#start-music-toggle')) return;
    if (event === 'keydown' && !['Enter', ' '].includes(input.key)) return;
    if (wantsMusic) syncStartMusic();
  });
}
window.addEventListener('pagehide', () => {
  startMusic.pause();
  startMusic.currentTime = 0;
});
window.addEventListener('pageshow', syncStartMusic);
updateMusicButton();
syncStartMusic();
