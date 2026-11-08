const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(reduced=false) {
  const nodes=new Map(),steps=[],events={};let plays=0;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,style:{},listeners:{},addEventListener(k,f){this.listeners[k]=f;},focus(){this.focused=true;},pause(){this.paused=true;},play(){plays++;return Promise.resolve();},animate(frames){steps.push(frames.map(f=>f.opacity));return {finished:Promise.resolve()};}});return nodes.get(id);};
  const window={matchMedia:()=>({matches:reduced}),addEventListener:(k,f)=>events[k]=f,location:{reload(){steps.push('reload');}}};
  vm.runInNewContext(fs.readFileSync('public/assets/js/scene-effects.js','utf8'),{window,document:{getElementById:get}});
  return {effects:window.sceneEffects,get,steps,events,plays:()=>plays};
}
test('scene changes happen under black, then fade back; failures never leave a curtain',async()=>{
  const h=setup();await h.effects.transition(async()=>{assert.equal(h.get('scene-curtain').style.opacity,'1');h.steps.push('scene');});
  assert.equal(JSON.stringify(h.steps),'[[0,1],"scene",[1,0]]');assert.equal(h.get('scene-curtain').hidden,true);
  await assert.rejects(h.effects.transition(async()=>{throw Error('failed');}));assert.equal(h.get('scene-curtain').hidden,true);
  const quiet=setup(true);await quiet.effects.transition(async()=>{});assert.equal(quiet.steps.length,0);
});
test('death plays once, other endings do not, replay and new game remain available',async()=>{
  const h=setup();h.effects.ending('escape');assert.equal(h.plays(),0);
  h.effects.ending('death','사망');h.effects.ending('death','사망');assert.equal(h.plays(),1);assert.equal(h.get('game-screen').inert,true);
  h.get('death-video').listeners.ended();assert.equal(h.get('death-replay').focused,true);
  h.get('death-replay').listeners.click();assert.equal(h.plays(),2);
  h.effects.ending(null);assert.equal(h.get('death-screen').hidden,true);assert.equal(h.get('game-screen').inert,false);
  h.get('death-video').play=()=>Promise.reject(Error('blocked'));await h.effects.play();assert.match(h.get('death-status').textContent,/재생 버튼/);
  h.get('death-video').listeners.error();assert.match(h.get('death-status').textContent,/불러오지/);
});
