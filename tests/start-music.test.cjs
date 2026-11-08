const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(blocked = false) {
  const documentEvents = {}, windowEvents = {}, videoEvents = {}, buttonEvents = {};
  const audio = {
    paused:true, currentTime:20, attempts:0,
    play() {
      ++this.attempts;
      if (blocked) return Promise.reject(Error('NotAllowedError'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; },
  };
  const video = {paused:false, addEventListener:(event, fn) => videoEvents[event] = fn};
  const button = {addEventListener:(event, fn) => buttonEvents[event] = fn,
    setAttribute(name, value) { this[name] = value; }};
  const document = {
    hidden:false,
    getElementById:id => id === 'start-music' ? audio : button,
    querySelector:() => video,
    addEventListener:(event, fn) => documentEvents[event] = fn,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/start-music.js'), 'utf8'), {
    document, window:{addEventListener:(event, fn) => windowEvents[event] = fn},
  });
  return {audio, video, button, document, documentEvents, windowEvents, videoEvents, buttonEvents,
    allowAudio() { blocked = false; }};
}

test('music follows the opening video, pauses off-page, and loops the supplied file only on the cover', async () => {
  const h = setup();
  await Promise.resolve();
  assert.equal(h.audio.paused, false);
  assert.equal(h.button['aria-label'], '음소거');
  h.video.paused = true;
  h.videoEvents.pause();
  assert.equal(h.audio.paused, true);
  h.video.paused = false;
  h.videoEvents.playing();
  assert.equal(h.audio.paused, false);
  h.document.hidden = true;
  h.documentEvents.visibilitychange();
  assert.equal(h.audio.paused, true);
  h.document.hidden = false;
  h.documentEvents.visibilitychange();
  assert.equal(h.audio.paused, false);
  h.windowEvents.pagehide();
  assert.equal(h.audio.paused, true);
  assert.equal(h.audio.currentTime, 0);
  const index = fs.readFileSync(path.join(__dirname, '../templates/index.html'), 'utf8');
  assert.match(index, /<audio id="start-music" loop[^>]+sunny-little-waltz\.mp3/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../templates/chat.html'), 'utf8'), /start-music/);
});

test('blocked autoplay retries on a gesture and the music button respects the off setting', async () => {
  const h = setup(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.audio.paused, true);
  assert.equal(h.button['aria-label'], '음소거');
  assert.equal(h.button['aria-pressed'], 'true');
  h.allowAudio();
  h.documentEvents.pointerdown({target:{closest:() => false}});
  await Promise.resolve();
  assert.equal(h.audio.paused, false);
  h.buttonEvents.click();
  assert.equal(h.audio.paused, true);
  assert.equal(h.button['aria-pressed'], 'false');
  assert.equal(h.button['aria-label'], '음악 켜기');
  h.documentEvents.pointerdown({target:{closest:() => false}});
  h.videoEvents.playing();
  assert.equal(h.audio.paused, true);
  h.buttonEvents.click();
  await Promise.resolve();
  assert.equal(h.audio.paused, false);
  assert.equal(h.button['aria-pressed'], 'true');
});

test('first click mutes even when the browser blocked default playback', async () => {
  const h = setup(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.button['aria-pressed'], 'true');
  h.buttonEvents.click();
  assert.equal(h.button['aria-label'], '음악 켜기');
  assert.equal(h.button['aria-pressed'], 'false');
  const attempts = h.audio.attempts;
  h.allowAudio();
  h.documentEvents.pointerdown({target:{closest:()=>false}});
  assert.equal(h.audio.attempts, attempts);
  h.buttonEvents.click();
  await Promise.resolve();
  assert.equal(h.audio.paused, false);
  assert.equal(h.button['aria-label'], '음소거');
});
