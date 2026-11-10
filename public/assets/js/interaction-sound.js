// 화면 클릭과 타자 입력의 효과음을 재생한다.
// Capture the click before a story action disables or removes its button.
(() => {
  if (typeof Audio === 'undefined') return;
  const sound = new Audio('/assets/audio/ui-click.wav');
  sound.volume = .4;
  const stop = () => { sound.pause(); sound.currentTime = 0; };
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button || button.disabled || button.id === 'location-music-toggle' ||
        document.hidden || window.locationMusic?.enabled === false) return;
    stop();
    sound.play().catch(() => {});
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
