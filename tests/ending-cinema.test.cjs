const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup() {
  const nodes=new Map(),renders=[],events={},animations=[];
  const node=key=>{
    if(!nodes.has(key)) nodes.set(key,{hidden:true,style:{},classList:{add(){},remove(){}},
      querySelector:node,focus(){},getAnimations:()=>[],pause(){},play:()=>Promise.resolve(),
      getBoundingClientRect:()=>({left:100,top:200,width:300,height:100}),
      animate(frames,options){animations.push({key,frames,options});return {finished:Promise.resolve()};}});
    return nodes.get(key);
  };
  const window={matchMedia:()=>({matches:false}),addEventListener:(k,f)=>events[k]=f};
  class Stage {
    constructor(){this.version=0;this.pages=['line'];this.pageIndex=0;}
    render(data){renders.push(data);this.ready=this.backgroundReady=Promise.resolve(true);}
    resetSelection(){} showPage(){}
  }
  const context={window,document:{getElementById:node},DialogueStage:Stage,setTimeout,clearTimeout,
    fetch(){throw Error('cinematic must never create a session');}};
  vm.runInNewContext(fs.readFileSync('public/assets/js/ending-cinema.js','utf8'),context);
  const ui=window.endingCinema;ui.wait=()=>Promise.resolve();
  return {ui,node,renders,events,animations};
}
for(const [gender,asset] of [['male','boy'],['female','girl']]) test(`${gender} assimilation automatically repeats the arrival and finishes once`,async()=>{
  const h=setup();await h.ui.show(true,gender);
  assert.equal(h.renders.length,3);
  assert.equal(h.renders[0].text,'어라.. 생각보다 맛이 괜찮네?');
  assert.equal(h.renders[1].text,'드디어 이사를 왔네, 여기 사람들은 어떨까?');
  assert.equal(h.renders[1].image,undefined);
  assert.equal(h.renders[2].background,'/assets/images/player_house.svg');
  assert.equal(h.renders[2].image,`/assets/images/character_user_${asset}.png`);
  assert.equal(h.renders[2].visitorId,'assimilated-player');
  assert.equal(h.renders[2].text,'어서와 더뉴빌리지에 온 거를 환영해!');
  assert.equal(h.node('.cinema-finale').hidden,false);
  assert.equal(h.node('.cinema-return').hidden,false);
  assert.ok(h.animations.some(a=>a.key==='.cinema-cursor'&&a.options.duration===2200));
  assert.ok(h.animations.some(a=>a.options.duration===2400));
  await h.ui.show(true,gender);assert.equal(h.renders.length,3);
});
test('exit cancels a pending cinematic before the fake start or visitor can appear',async()=>{
  const h=setup();let resume;
  h.ui.stage.ready=Promise.resolve(true);
  h.ui.wait=()=>new Promise(resolve=>resume=resolve);
  const playing=h.ui.show(true,'female');await new Promise(setImmediate);
  h.events.pagehide();resume();await playing;
  assert.equal(h.node('ending-cinema').hidden,true);assert.equal(h.renders.length,1);
});
test('death and escape can finish directly, repeated finishing is ignored and reset permits a new ending',async()=>{
  const h=setup();await h.ui.finish();const count=h.animations.length;
  await h.ui.finish();assert.equal(h.animations.length,count);assert.equal(h.renders.length,0);
  h.ui.reset();assert.equal(h.node('ending-cinema').hidden,true);
  await h.ui.finish();assert.ok(h.animations.length>count);
});
