const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
  const events={},windowEvents={},button={attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this[k]=f;}};
  const audio={paused:true,currentTime:0,plays:0,pause(){this.paused=true;},play(){this.plays++;this.paused=false;return Promise.resolve();},removeAttribute(k){delete this[k];}};
  const ambience={...audio};
  const document={hidden:false,getElementById:id=>id==='location-music'?audio:id==='festival-ambience'?ambience:button,addEventListener:(k,f)=>events[k]=f};
  const window={addEventListener:(k,f)=>windowEvents[k]=f};
  vm.runInNewContext(fs.readFileSync('public/assets/js/location-music.js','utf8'),{document,window});
  return {music:window.locationMusic,audio,ambience,button,document,events,windowEvents};
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

test('the salon mission uses its own track, preserves mute and returns to salon music after the result',()=>{
  const h=setup();h.music.enter('salon');
  h.music.enter('salon',null,'cathy_help');assert.equal(h.audio.src,'/assets/audio/cathy-minigame-bgm.mp3');
  h.audio.currentTime=12;const plays=h.audio.plays;
  h.music.enter('salon',null,'cathy_help');assert.equal(h.audio.currentTime,12);assert.equal(h.audio.plays,plays);
  h.button.click();h.music.enter('salon',null,'cathy_result');
  assert.equal(h.audio.src,'/assets/audio/salon-bgm.mp3');assert.equal(h.audio.paused,true);
  h.music.enter('salon',null,'cathy_help');assert.equal(h.audio.paused,true);
  h.music.enter('square','death','ending');assert.equal(h.audio.paused,true);
});

test('the dark butcher and basement share one track, later scenes share aftermath except the secret room',()=>{
  const h=setup();
  h.music.enter('butcher_shop',null,'neighbors');assert.equal(h.audio.src,'/assets/audio/butcher-bgm.mp3');
  for (const scene of ['butcher_search','empty_butcher','basement_entry','basement','bob_caught']) {
    h.music.enter(scene==='basement'?'basement':'butcher_shop',null,scene);
    assert.equal(h.audio.src,'/assets/audio/frightened-jimmy-bgm.mp3');
    h.audio.currentTime=9;
  }
  assert.equal(h.audio.currentTime,9);
  for (const scene of ['dinner_invite','wait_dinner','karen_dinner','checkpoint','job_choice','job_result','festival_invite']) {
    h.music.enter('square',null,scene);assert.equal(h.audio.src,'/assets/audio/after-basement-bgm.mp3');
    h.audio.currentTime=12;
  }
  h.music.enter('karen_house',null,'photo_found');assert.equal(h.audio.src,'/assets/audio/urgent-bgm.mp3');
  h.audio.currentTime=7;h.music.enter('karen_house',null,'photo_found');assert.equal(h.audio.currentTime,7);
  h.button.click();h.music.enter('player_house',null,'checkpoint');assert.equal(h.audio.paused,true);
  assert.equal(h.audio.src,'/assets/audio/after-basement-bgm.mp3');
  h.music.enter('square','death','ending');assert.equal(h.audio.src,undefined);
  h.music.enter('player_house',null,'arrival');assert.equal(h.audio.src,'/assets/audio/home-bgm.mp3');
});

test('festival layers ambience over square music without restarting, and both obey mute, visibility and exit',async()=>{
  const h=setup();
  for(const scene of ['festival','hair_found','final_choice']) {
    h.music.enter('square',null,scene);
    assert.equal(h.audio.src,'/assets/audio/square-bgm.mp3');
    assert.equal(h.ambience.paused,false);
    h.ambience.currentTime=20;
  }
  assert.equal(h.ambience.currentTime,20);assert.equal(h.ambience.plays,1);
  h.button.click();assert.equal(h.ambience.paused,true);assert.equal(h.audio.paused,true);
  h.button.click();assert.equal(h.ambience.paused,false);
  h.document.hidden=true;h.events.visibilitychange();assert.equal(h.ambience.paused,true);
  h.document.hidden=false;h.events.visibilitychange();assert.equal(h.ambience.paused,false);
  h.music.enter('truck',null,'truck_escape');assert.equal(h.ambience.paused,true);assert.equal(h.ambience.currentTime,0);
  h.music.enter('square',null,'festival');h.music.enter('square','assimilation','ending');assert.equal(h.ambience.paused,true);
  h.music.enter('square',null,'festival');h.windowEvents.pagehide();assert.equal(h.ambience.paused,true);assert.equal(h.ambience.currentTime,0);
  const blocked=setup();blocked.ambience.play=()=>Promise.reject(Error('blocked'));
  blocked.music.enter('square',null,'festival');await Promise.resolve();
  blocked.ambience.play=()=>{blocked.ambience.paused=false;return Promise.resolve();};
  blocked.events.pointerdown({target:{closest:()=>false}});assert.equal(blocked.ambience.paused,false);
});
