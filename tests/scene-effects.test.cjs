const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(reduced=false) {
  const nodes=new Map(),steps=[],events={},durations=[];let plays=0;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,paused:true,plays:0,style:{},dataset:{maleSrc:'/assets/videos/video_ending_die_boy.mp4'},listeners:{},classList:{add(){},remove(){}},addEventListener(k,f){this.listeners[k]=f;},removeAttribute(k){delete this[k];},focus(){this.focused=true;},pause(){this.paused=true;},play(){if(id==='death-video')plays++;this.plays++;this.paused=false;return Promise.resolve();},animate(frames,options){steps.push(frames.map(f=>f.opacity));durations.push(options.duration);return {finished:Promise.resolve()};}});return nodes.get(id);};
  const window={matchMedia:()=>({matches:reduced}),addEventListener:(k,f)=>events[k]=f,location:{reload(){steps.push('reload');}}};
  const document={hidden:false,getElementById:get,addEventListener:(k,f)=>events[k]=f};
  vm.runInNewContext(fs.readFileSync('public/assets/js/scene-effects.js','utf8'),{window,document});
  return {effects:window.sceneEffects,get,steps,events,durations,window,document,plays:()=>plays};
}
test('scene changes happen under black, then fade back; failures never leave a curtain',async()=>{
  const h=setup();await h.effects.transition(async()=>{assert.equal(h.get('scene-curtain').style.opacity,'1');h.steps.push('scene');});
  assert.equal(JSON.stringify(h.steps),'[[0,1],"scene",[1,0]]');assert.equal(h.get('scene-curtain').hidden,true);
  assert.deepEqual(h.durations,[180,180]);
  await assert.rejects(h.effects.transition(async()=>{throw Error('failed');}));assert.equal(h.get('scene-curtain').hidden,true);
  const quiet=setup(true);await quiet.effects.transition(async()=>{});assert.equal(quiet.steps.length,0);
});
test('date change replaces only the day on the dark transition',async()=>{
  const h=setup(true);
  await h.effects.transition(async()=>{
    assert.equal(h.get('scene-date-transition').hidden,false);
    assert.equal(h.get('scene-date-base').textContent,'1955.11.');
    assert.equal(h.get('scene-date-old').textContent,'7');
    assert.equal(h.get('scene-date-new').textContent,'8');
  },{from:'1955.11.7',to:'1955.11.8'});
  assert.equal(h.get('scene-date-transition').hidden,true);
});
test('assimilation shows the START replay before returning to character choice',()=>{
  const h=setup();
  h.effects.ending('assimilation');
  assert.equal(h.get('assimilation-screen').hidden,false);
  h.effects.ending(null);
  assert.equal(h.get('assimilation-screen').hidden,true);
  const html=fs.readFileSync('templates/chat.html','utf8');
  assert.match(html,/id="assimilation-screen"/);
});
test('escape uses the comic and disables the game underneath, returning clears it',()=>{
  const h=setup();const calls=[];h.window.escapeComic={show:(...args)=>calls.push(args)};
  h.effects.ending('escape','탈출','female');assert.deepEqual(calls[0],[true,'탈출','female']);
  assert.equal(h.get('game-screen').inert,true);assert.equal(h.plays(),0);
  h.effects.ending(null);assert.deepEqual(calls[1],[false,'',null]);assert.equal(h.get('game-screen').inert,false);
});

test('death plays once, other endings do not, replay and new game remain available',async()=>{
  const h=setup();h.effects.ending('escape');assert.equal(h.plays(),0);
  h.effects.ending('death','사망','male');h.effects.ending('death','사망','male');assert.equal(h.plays(),1);assert.equal(h.get('game-screen').inert,true);
  assert.equal(h.get('death-video').src,'/assets/videos/video_ending_die_boy.mp4');
  assert.equal(h.get('death-controls').hidden,true);
  h.get('death-video').listeners.ended();assert.equal(h.get('death-replay').focused,true);
  assert.equal(h.get('death-controls').hidden,false);
  h.get('death-replay').listeners.click();assert.equal(h.plays(),2);
  assert.equal(h.get('death-controls').hidden,true);
  h.effects.ending(null);assert.equal(h.get('death-screen').hidden,true);assert.equal(h.get('game-screen').inert,false);
  h.get('death-video').play=()=>Promise.reject(Error('blocked'));await h.effects.play();assert.match(h.get('death-status').textContent,/재생 버튼/);
  assert.equal(h.get('death-controls').hidden,false);
  h.get('death-video').listeners.error();assert.match(h.get('death-status').textContent,/불러오지/);
});

test('female death uses the supplied female film, and a missing source retains the fallback',()=>{
  const template=fs.readFileSync('templates/chat.html','utf8');
  assert.match(template,/<video id="death-video"[^>]*data-male-src=/);
  assert.match(template,/<video id="death-video"[^>]*data-female-src="[^\n]*video_ending_die_girl\.mp4/);
  assert.doesNotMatch(template,/<video id="death-video"[^>]*\ssrc=/);
  const h=setup();h.effects.ending('death','사망','female');
  assert.equal(h.plays(),0);
  assert.equal(h.get('death-video').hidden,true);
  assert.equal(h.get('death-video').src,undefined);
  assert.equal(h.get('death-replay').hidden,true);
  assert.equal(h.get('death-controls').hidden,false);
  assert.match(h.get('death-status').textContent,/준비 중/);
  assert.equal(h.get('death-description').textContent,'사망');
  const ready=setup();ready.get('death-video').dataset.femaleSrc='/assets/videos/video_ending_die_girl.mp4';
  ready.effects.ending('death','사망','female');
  assert.equal(ready.plays(),1);
  assert.equal(ready.get('death-video').src,'/assets/videos/video_ending_die_girl.mp4');
});

test('assimilation uses one ending screen and death always finishes on the common The End page',()=>{
  const h=setup(),calls=[];
  h.window.endingCinema={show:(...args)=>calls.push(args),reset:()=>calls.push('reset'),finish:()=>calls.push('finish')};
  h.effects.ending('assimilation','동화','female');
  assert.deepEqual(calls[0],[true,'female']);assert.equal(h.get('game-screen').inert,true);
  assert.equal(h.get('assimilation-screen').hidden,true);
  h.effects.ending('death','사망','male');assert.equal(calls.includes('finish'),false);
  h.get('death-video').listeners.ended();assert.equal(calls.includes('finish'),true);
  assert.equal(h.get('death-controls').hidden,true);
  h.effects.ending(null);assert.ok(calls.includes('reset'));assert.equal(h.get('game-screen').inert,false);
});

test('only server-confirmed butcher death waits for the scare; duplicates and cancelled scares never start a film',async()=>{
  const h=setup();let finish,scares=0;
  h.window.butcherScare={play(){scares++;return new Promise(resolve=>finish=resolve);},reset(){}};
  h.effects.ending('death','정육점','male','butcher_shop');
  h.effects.ending('death','정육점','male','butcher_shop');
  assert.equal(scares,1);assert.equal(h.plays(),0);
  finish(true);await Promise.resolve();assert.equal(h.plays(),1);
  h.effects.ending(null);
  h.effects.ending('death','트럭','male','square');assert.equal(h.plays(),2);assert.equal(scares,1);
  h.effects.ending(null);h.effects.ending('death','정육점','male','butcher_shop');
  h.events.pagehide();finish(false);await Promise.resolve();assert.equal(h.plays(),2);
});

test('bad ending music starts with actual film playback, survives The End, and stops on new play or exit',async()=>{
  const h=setup(),music=h.get('death-music'),video=h.get('death-video');let finish,finales=0;
  h.window.butcherScare={play:()=>new Promise(resolve=>finish=resolve),reset(){}};
  h.window.endingCinema={show(){},reset(){},finish(){finales++;}};
  h.effects.ending('death','','male','butcher_shop');assert.equal(music.plays,0);
  finish(true);await Promise.resolve();assert.equal(music.plays,0);
  video.listeners.playing();assert.equal(music.plays,1);
  music.currentTime=3;h.effects.ending('death','','male','butcher_shop');assert.equal(music.currentTime,3);
  h.document.hidden=true;h.events.visibilitychange();assert.equal(music.paused,true);
  h.document.hidden=false;h.events.visibilitychange();assert.equal(music.paused,false);
  video.paused=true;video.listeners.pause();assert.equal(music.paused,true);
  h.get('death-replay').listeners.click();video.listeners.playing();assert.equal(music.currentTime,0);assert.equal(music.paused,false);
  video.ended=true;video.paused=true;video.listeners.pause();video.listeners.ended();
  assert.equal(finales,1);assert.equal(music.paused,false);assert.equal(h.get('death-controls').hidden,true);
  h.effects.ending(null);assert.equal(music.paused,true);assert.equal(music.currentTime,0);
  h.effects.ending('death','','male');video.ended=false;video.listeners.playing();
  h.events.pagehide();assert.equal(music.paused,true);assert.equal(music.currentTime,0);
});

test('mute and blocked music never prevent The End; video failure still offers a finish action',async()=>{
  const h=setup(),music=h.get('death-music'),video=h.get('death-video');let finishes=0;
  h.window.endingCinema={show(){},reset(){},finish(){finishes++;}};
  h.window.locationMusic={enabled:false};
  h.effects.ending('death','','male');video.listeners.playing();assert.equal(music.plays,0);
  h.window.locationMusic.enabled=true;music.play=()=>Promise.reject(Error('blocked'));
  video.listeners.playing();await new Promise(setImmediate);
  video.listeners.ended();assert.equal(finishes,1);
  video.listeners.error();assert.equal(h.get('death-finish').hidden,false);
  h.get('death-finish').listeners.click();assert.equal(finishes,2);
});
