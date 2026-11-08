const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
  const events={},windowEvents={},button={attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this[k]=f;}};
  const audio={paused:true,currentTime:0,plays:0,pause(){this.paused=true;},play(){this.plays++;this.paused=false;return Promise.resolve();},removeAttribute(k){delete this[k];}};
  const document={hidden:false,getElementById:id=>id==='location-music'?audio:button,addEventListener:(k,f)=>events[k]=f};
  const window={addEventListener:(k,f)=>windowEvents[k]=f};
  vm.runInNewContext(fs.readFileSync('public/assets/js/location-music.js','utf8'),{document,window});
  return {music:window.locationMusic,audio,button,document,events,windowEvents};
}
test('five locations use their tracks; dialogue renders never restart the same music',()=>{
  const h=setup();
  for(const [place,file] of Object.entries({butcher_shop:'butcher',salon:'salon',square:'square',player_house:'home',karen_house:'karen'})){
    h.music.enter(place);assert.equal(h.audio.src,`/assets/audio/${file}-bgm.mp3`);assert.equal(h.audio.paused,false);
    h.audio.currentTime=10;const plays=h.audio.plays;h.music.enter(place);assert.equal(h.audio.currentTime,10);assert.equal(h.audio.plays,plays);
  }
  h.music.enter('basement');assert.equal(h.audio.paused,true);assert.equal(h.audio.src,undefined);
});
test('mute survives location changes; tab hiding, endings and page exit stop music',()=>{
  const h=setup();h.music.enter('salon');h.button.click();assert.equal(h.audio.paused,true);
  h.music.enter('square');assert.equal(h.audio.paused,true);assert.equal(h.button.attrs['aria-pressed'],'false');
  h.events.pointerdown({target:{closest:()=>false}});assert.equal(h.audio.paused,true);
  h.button.click();assert.equal(h.audio.paused,false);
  h.document.hidden=true;h.events.visibilitychange();assert.equal(h.audio.paused,true);
  h.document.hidden=false;h.events.visibilitychange();assert.equal(h.audio.paused,false);
  h.music.enter('square','death');assert.equal(h.audio.paused,true);assert.equal(h.button.hidden,true);
  h.music.enter('player_house');assert.equal(h.button.hidden,false);h.windowEvents.pagehide();assert.equal(h.audio.paused,true);assert.equal(h.audio.currentTime,0);
});
test('blocked playback retries on a gesture without changing the enabled preference',async()=>{
  const h=setup();h.audio.play=()=>Promise.reject(Error('blocked'));h.music.enter('salon');await Promise.resolve();
  assert.equal(h.button.attrs['aria-pressed'],'true');
  h.audio.play=()=>{h.audio.paused=false;return Promise.resolve();};
  h.events.pointerdown({target:{closest:()=>false}});assert.equal(h.audio.paused,false);
});
