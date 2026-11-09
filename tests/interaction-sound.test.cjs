const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup() {
  const events={},windowEvents={},window={locationMusic:{enabled:true},addEventListener:(key,fn)=>windowEvents[key]=fn};
  let sound;
  const document={hidden:false,addEventListener:(key,fn,capture)=>events[key]={fn,capture}};
  class Audio { constructor(path){this.path=path;this.plays=0;sound=this;} pause(){this.paused=true;} play(){this.plays++;return Promise.resolve();} }
  vm.runInNewContext(fs.readFileSync('public/assets/js/interaction-sound.js','utf8'),{window,document,Audio});
  return {sound,events,windowEvents,window,document,click:button=>events.click.fn({target:{closest:()=>button}})};
}
test('dialogue and selection clicks sound before their handlers, including keyboard-generated clicks',()=>{
  const h=setup();assert.equal(h.events.click.capture,true);
  assert.equal(h.sound.path,'/assets/audio/ui-click.wav');
  for (const id of ['entry-watch','entry-answer','next-page','story-action','tool-shampoo']) {
    h.sound.currentTime=1;h.click({id,disabled:false});assert.equal(h.sound.currentTime,0);
  }
  assert.equal(h.sound.plays,5);
});
test('disabled controls, nonbuttons, mute and hidden pages remain quiet; exit stops the clip',async()=>{
  const h=setup();h.click(null);h.click({disabled:true});h.click({id:'location-music-toggle'});
  h.window.locationMusic.enabled=false;h.click({});
  h.window.locationMusic.enabled=true;h.document.hidden=true;h.click({});
  assert.equal(h.sound.plays,0);
  h.events.visibilitychange.fn();assert.equal(h.sound.paused,true);
  h.document.hidden=false;h.sound.play=()=>Promise.reject(Error('blocked'));h.click({});await Promise.resolve();
  h.windowEvents.pagehide();assert.equal(h.sound.currentTime,0);
});
