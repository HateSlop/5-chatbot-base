// Open soon after the last ring starts; let the sound's tail finish naturally.
window.Doorbell = class {
  constructor() {
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    document.getElementById('location-music-toggle')?.addEventListener('click', () => {
      if (window.locationMusic?.enabled === false) this.stop();
    });
  }
  ring(count = 1) {
    if (this.pending) return this.pending;
    if (typeof Audio === 'undefined' || document.hidden || window.locationMusic?.enabled === false) return Promise.resolve();
    const sounds = [], timers = [];
    let resolve, done = false;
    this.pending = new Promise(finish => { resolve = finish; });
    const pending = this.pending;
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      for (const sound of sounds) { sound.onended = sound.onerror = null; sound.pause(); sound.currentTime = 0; }
      this.pending = null;
      resolve();
    };
    this.stop = finish;
    timers.push(setTimeout(finish, 7000));
    for (let index = 0; index < count; index++) {
      const sound = new Audio('/assets/audio/doorbell.wav');
      sound.volume = .7;
      sounds.push(sound);
      sound.onerror = finish;
      if (index === count - 1) sound.onended = finish;
      const play = () => {
        sound.play().then(() => {
          if (!done && index === count - 1) timers.push(setTimeout(resolve, 450));
        }).catch(finish);
      };
      if (index === 0) play();
      else timers.push(setTimeout(play, index * 300));
    }
    return pending;
  }
  stop() {}
};
