// doorbell 기능의 화면 동작을 확인하는 회귀 검사다.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup() {
  const sounds=[],timers=new Map(),events={},window={locationMusic:{enabled:true}};let id=0;
  const document={hidden:false,addEventListener:(key,fn)=>events[key]=fn,getElementById:()=>({addEventListener:(key,fn)=>events.mute=fn})};
  class Audio {
    constructor(path){this.path=path;this.plays=0;sounds.push(this);}
    play(){this.plays++;return Promise.resolve();}
    pause(){this.paused=true;}
  }
  vm.runInNewContext(fs.readFileSync('public/assets/js/doorbell.js','utf8'),{window,document,Audio,
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:key=>timers.delete(key)});
  return {bell:new window.Doorbell(),sounds,timers,events,document,window};
}
test('ordinary visit opens 450ms after playback starts while the sound tail continues',async()=>{
  const h=setup();let finished=false;
  const ready=h.bell.ring();ready.then(()=>finished=true);
  assert.equal(h.bell.ring(),ready);assert.equal(h.sounds.length,1);
  assert.equal(h.sounds[0].path,'/assets/audio/doorbell.wav');
  await Promise.resolve();assert.equal(finished,false);
  [...h.timers.values()].find(timer=>timer.ms===450).fn();await ready;
  assert.equal(finished,true);assert.notEqual(h.sounds[0].paused,true);
  h.sounds[0].onended();assert.equal(h.timers.size,0);
});
test('urgent visit rings three times, then opens before the last sound tail ends',async()=>{
  const h=setup();const ready=h.bell.ring(3);
  assert.deepEqual(h.sounds.map(sound=>sound.plays),[1,0,0]);
  for(const ms of [300,600]) [...h.timers.values()].find(timer=>timer.ms===ms).fn();
  assert.deepEqual(h.sounds.map(sound=>sound.plays),[1,1,1]);
  await Promise.resolve();
  [...h.timers.values()].find(timer=>timer.ms===450).fn();await ready;
  assert.notEqual(h.sounds[2].paused,true);
  h.sounds[2].onended();
  assert.ok(h.sounds.every(sound=>sound.paused));assert.equal(h.timers.size,0);
});

test('cancelling before playback resolves cannot leave a delayed door-opening timer',async()=>{
  const h=setup();const ready=h.bell.ring();h.bell.stop();await ready;await Promise.resolve();
  assert.equal(h.timers.size,0);
});
test('mute, hidden tab, failed playback and stalled audio cannot block the visit',async()=>{
  const h=setup();h.window.locationMusic.enabled=false;await h.bell.ring();assert.equal(h.sounds.length,0);
  h.window.locationMusic.enabled=true;let ready=h.bell.ring(3);
  h.document.hidden=true;h.events.visibilitychange();await ready;assert.equal(h.timers.size,0);
  h.document.hidden=false;ready=h.bell.ring();h.sounds.at(-1).onerror();await ready;
  ready=h.bell.ring();[...h.timers.values()].find(timer=>timer.ms===7000).fn();await ready;
  ready=h.bell.ring();h.window.locationMusic.enabled=false;h.events.mute();await ready;
  const blocked=setup();const original=blocked.bell.ring.bind(blocked.bell);
  // Reject on a later rapid ring, as happens when playback permission is revoked.
  ready=original(3);blocked.sounds[1].play=()=>Promise.reject(Error('blocked'));
  [...blocked.timers.values()].find(timer=>timer.ms===300).fn();await ready;
  assert.equal(blocked.timers.size,0);
});
