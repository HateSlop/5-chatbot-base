const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function setup({prologue=false}={}){
  const nodes=new Map(),events={},renders=[],timers=new Map();let delay;
  let finishPrologue;
  let resizeTV;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{},listeners:{},querySelector(){return {decode:async()=>{}};},addEventListener(k,fn){this.listeners[k]=fn;},showModal(){this.open=true;},close(){this.open=false;},pause(){this.paused=true;},play(){this.paused=false;this.plays=(this.plays||0)+1;return Promise.resolve();},focus(){this.focused=true;}});return nodes.get(id);};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/arrival-entry.js'),'utf8'),{
    document:{getElementById:get},window:{addEventListener:(k,fn)=>events[k]=fn,
      ...(prologue ? {Prologue:class {play(){return new Promise(resolve=>finishPrologue=resolve);}}} : {})},
    DialogueStage:class{render(data){renders.push(data);}},PostMoveUI:class{render(){} setSplit(){}},
    ResizeObserver:class {constructor(callback){resizeTV=callback;} observe(){}},
    setTimeout:(fn,ms)=>{delay=ms;timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id),
    fetch(){throw Error('Entry presentation must not create a session');},localStorage:new Proxy({},{get(){throw Error('No storage');}}),
  });
  await new Promise(r=>setImmediate(r));return {get,events,renders,timers,resizeTV:()=>resizeTV(),finishPrologue:result=>finishPrologue(result),get delay(){return delay;}};
}
test('live entry begins at the pre-move house, then waits for Jimmy after departure',async()=>{
  const h=await setup();assert.equal(h.renders[0].background,'/assets/images/pre-move-house.png');
  assert.equal(h.renders[0].dialogue,false);assert.equal(h.renders.at(-1).text,'티비나 볼까?');
  assert.equal(h.get('entry-depart').hidden,true);
  h.get('entry-tv-hotspot').listeners.click();
  assert.equal(h.get('entry-ad-dialog').open,true);
  await h.get('entry-ad-video').listeners.ended();
  assert.equal(h.renders.at(-1).text,'저기로 갈까?');
  assert.equal(h.get('entry-depart').hidden,false);
  assert.equal(h.timers.size,0);
  h.get('entry-depart').listeners.click();await new Promise(r=>setImmediate(r));
  assert.equal(h.renders.at(-1).dialogue,false);assert.equal(h.delay,1500);
  h.timers.get(1)();assert.equal(h.renders.at(-1).speaker,'지미');
  assert.equal(h.get('entry-answer').hidden,false);
  h.get('entry-answer').listeners.click();assert.equal(h.get('entry-name-dialog').open,true);assert.equal(h.get('username').focused,true);
});
test('leaving cancels pending Jimmy appearance',async()=>{
  const h=await setup();h.events.pagehide();assert.equal(h.timers.size,0);
});

test('ad must finish before departure; playback failure offers retry and recovery',async()=>{
  const h=await setup();
  h.get('entry-depart').listeners.click();assert.equal(h.timers.size,0);
  h.get('entry-ad-video').play=()=>Promise.reject(Error('blocked'));
  h.get('entry-tv-hotspot').listeners.click();await new Promise(r=>setImmediate(r));
  assert.equal(h.get('entry-ad-retry').hidden,false);
  assert.equal(h.get('entry-depart').hidden,true);
  h.get('entry-ad-video').listeners.error();assert.equal(h.get('entry-ad-continue').hidden,false);
  await h.get('entry-ad-continue').listeners.click();
  assert.equal(h.renders.at(-1).text,'저기로 갈까?');
  assert.equal(h.get('entry-ad-dialog').open,false);
});

test('the old house waits for the notebook before the TV line and clickable TV appear',async()=>{
  const h=await setup({prologue:true});
  assert.equal(h.renders.at(-1).dialogue,false);
  assert.equal(h.get('entry-tv-hotspot').hidden,true);
  assert.equal(h.get('entry-stage').inert,true);
  h.get('entry-tv-hotspot').listeners.click();assert.equal(h.get('entry-ad-dialog').open,undefined);
  h.finishPrologue(true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.renders.at(-1).text,'티비나 볼까?');
  assert.equal(h.get('entry-stage').inert,false);
  assert.equal(h.get('entry-tv-hotspot').hidden,false);
  assert.equal(h.get('entry-tv-hotspot').focused,true);
});

test('leaving during the notebook never opens the TV dialogue afterwards',async()=>{
  const h=await setup({prologue:true});h.events.pagehide();h.finishPrologue(false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.renders.length,1);assert.equal(h.get('entry-tv-hotspot').hidden,true);
});

test('the TV cutout stays aligned with the background cover crop when the screen resizes',async()=>{
  const h=await setup();const root=h.get('entry-stage'),tv=h.get('entry-tv-hotspot');
  root.clientWidth=728;root.clientHeight=408;h.resizeTV();
  assert.equal(tv.style.width,'728px');assert.equal(tv.style.left,'0px');assert.equal(tv.style.top,'0px');
  root.clientWidth=400;root.clientHeight=816;h.resizeTV();
  assert.equal(tv.style.width,'1456px');assert.equal(tv.style.left,'-528px');assert.equal(tv.style.top,'0px');
  root.clientWidth=1456;root.clientHeight=400;h.resizeTV();
  assert.equal(tv.style.height,'816px');assert.equal(tv.style.top,'-208px');
});

test('clicking the TV opens the ad only once and the old text button is absent',async()=>{
  const h=await setup();const tv=h.get('entry-tv-hotspot'),ad=h.get('entry-ad-video');
  tv.listeners.click();tv.listeners.click();assert.equal(ad.plays,1);assert.equal(tv.hidden,true);
  await ad.listeners.ended();assert.equal(tv.hidden,true);assert.equal(h.get('entry-depart').hidden,false);
  const markup=fs.readFileSync(path.join(__dirname,'../templates/chat.html'),'utf8');
  assert.doesNotMatch(markup,/id="entry-watch"|>TV 보기 ›/);
  assert.match(markup,/<button id="entry-tv-hotspot"[^>]*aria-label="TV를 켜서 광고 보기"/);
});
