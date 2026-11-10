const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(reduced=false) {
  const nodes=new Map(),steps=[],events={},durations=[];let plays=0;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,style:{},dataset:{maleSrc:'/assets/videos/video_ending_die_boy.mp4'},listeners:{},addEventListener(k,f){this.listeners[k]=f;},removeAttribute(k){delete this[k];},focus(){this.focused=true;},pause(){this.paused=true;},play(){plays++;return Promise.resolve();},animate(frames,options){steps.push(frames.map(f=>f.opacity));durations.push(options.duration);return {finished:Promise.resolve()};}});return nodes.get(id);};
  const window={matchMedia:()=>({matches:reduced}),addEventListener:(k,f)=>events[k]=f,location:{reload(){steps.push('reload');}}};
  vm.runInNewContext(fs.readFileSync('public/assets/js/scene-effects.js','utf8'),{window,document:{getElementById:get}});
  return {effects:window.sceneEffects,get,steps,events,durations,window,plays:()=>plays};
}
test('scene changes happen under black, then fade back; failures never leave a curtain',async()=>{
  const h=setup();await h.effects.transition(async()=>{assert.equal(h.get('scene-curtain').style.opacity,'1');h.steps.push('scene');});
  assert.equal(JSON.stringify(h.steps),'[[0,1],"scene",[1,0]]');assert.equal(h.get('scene-curtain').hidden,true);
  assert.deepEqual(h.durations,[180,180]);
  await assert.rejects(h.effects.transition(async()=>{throw Error('failed');}));assert.equal(h.get('scene-curtain').hidden,true);
  const quiet=setup(true);await quiet.effects.transition(async()=>{});assert.equal(quiet.steps.length,0);
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

test('assimilation locks play and uses the selected gender, death finishes only when its video ends',()=>{
  const h=setup(),calls=[];
  h.window.endingCinema={show:(...args)=>calls.push(args),reset:()=>calls.push('reset'),finish:()=>calls.push('finish')};
  h.effects.ending('assimilation','동화','female');
  assert.deepEqual(calls[0],[true,'female']);assert.equal(h.get('game-screen').inert,true);
  h.effects.ending('death','사망','male');assert.equal(calls.includes('finish'),false);
  h.get('death-video').listeners.ended();assert.equal(calls.at(-1),'finish');
  assert.equal(h.get('death-controls').hidden,true);
  h.effects.ending(null);assert.ok(calls.includes('reset'));assert.equal(h.get('game-screen').inert,false);
});
