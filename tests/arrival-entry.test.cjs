const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function setup({prologue=false,genderReady=true}={}){
  const nodes=new Map(),events={},renders=[],timers=new Map();let delay;
  let finishPrologue;
  let resizeTV;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,style:{},dataset:{},listeners:{},querySelector(){return {decode:async()=>{}};},addEventListener(k,fn){this.listeners[k]=fn;},showModal(){this.open=true;},close(){this.open=false;},pause(){this.paused=true;},play(){this.paused=false;this.plays=(this.plays||0)+1;return Promise.resolve();},focus(){this.focused=true;}});return nodes.get(id);};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/arrival-entry.js'),'utf8'),{
    document:{getElementById:get},window:{protagonistGenderReady:genderReady,addEventListener:(k,fn)=>events[k]=fn,
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
  assert.equal(h.renders[0].dialogue,false);assert.equal(h.renders.at(-1).text,'하아… 생각만 한다고 달라지는 건 없겠지.\n\n일단 TV나 볼까…? 뭐라도 보고 있으면 좀 나아지려나.');
  assert.equal(h.get('entry-depart').hidden,true);
  h.get('entry-tv-hotspot').listeners.click();
  assert.equal(h.get('entry-ad-dialog').open,true);
  await h.get('entry-ad-video').listeners.ended();
  assert.equal(h.renders.at(-1).text,'오…? 이런 곳도 있었네?\n\n마을도 평화로워 보이고, 사람들도 다들 좋아 보이는데…\n\n여기라면 나도 새롭게 시작할 수 있지 않을까?\n\n좋아, 한번 가보자!');
  assert.equal(h.get('entry-depart').hidden,false);
  assert.equal(h.timers.size,0);
  h.get('entry-depart').listeners.click();await new Promise(r=>setImmediate(r));
  assert.equal(h.renders.at(-1).dialogue,false);assert.equal(h.delay,1500);
  h.timers.get(1)();assert.equal(h.renders.at(-1).speaker,'지미');
  assert.match(h.renders.at(-1).text,/내 친구 찰스가 지난주에 마을을 떠나서 외로웠던 참이었어!/);
  assert.match(h.renders.at(-1).text,/아 참, 너의 이름은 뭐야\?$/);
  assert.equal(h.get('entry-answer').hidden,false);
  h.get('entry-answer').listeners.click();assert.equal(h.get('entry-name-dialog').open,true);assert.equal(h.get('username').focused,true);
});
test('leaving cancels pending Jimmy appearance',async()=>{
  const h=await setup();h.events.pagehide();assert.equal(h.timers.size,0);
});
test('the intro waits until gender has been selected',async()=>{
  const h=await setup({genderReady:false,prologue:true});
  assert.equal(h.renders.length,0);
  assert.equal(h.timers.size,0);
});

test('the ad can be skipped during normal playback and continues with the post-ad monologue',async()=>{
  const h=await setup();
  h.get('entry-tv-hotspot').listeners.click();
  assert.equal(h.get('entry-ad-continue').hidden,false);
  await h.get('entry-ad-continue').listeners.click();
  assert.equal(h.get('entry-ad-video').paused,true);
  assert.equal(h.get('entry-ad-dialog').open,false);
  assert.match(h.renders.at(-1).text,/좋아, 한번 가보자!/);
});

test('departure waits for the final TV monologue page to finish and has no truck emoji',async()=>{
  const h=await setup();
  h.get('entry-tv-hotspot').listeners.click();
  await h.get('entry-ad-video').listeners.ended();
  const root=h.get('entry-stage');
  root.dataset.dialogueComplete='false';
  await h.get('entry-depart').listeners.click();
  assert.equal(h.timers.size,0);
  root.dataset.dialogueComplete='true';
  await h.get('entry-depart').listeners.click();
  assert.equal(h.delay,1500);
  const markup=fs.readFileSync(path.join(__dirname,'../templates/chat.html'),'utf8');
  assert.match(markup,/id="entry-depart"[^>]*>더뉴빌리지로 이사 가기<\/button>/);
  const css=fs.readFileSync(path.join(__dirname,'../public/assets/css/village-theme.css'),'utf8');
  assert.match(css,/data-dialogue-complete="false"[^}]*\.dialogue-advance[^}]*visibility: hidden/);
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
  assert.equal(h.renders.at(-1).text,'오…? 이런 곳도 있었네?\n\n마을도 평화로워 보이고, 사람들도 다들 좋아 보이는데…\n\n여기라면 나도 새롭게 시작할 수 있지 않을까?\n\n좋아, 한번 가보자!');
  assert.equal(h.get('entry-ad-dialog').open,false);
});

test('the old house waits for the notebook before the TV line and clickable TV appear',async()=>{
  const h=await setup({prologue:true});
  assert.equal(h.renders.at(-1).dialogue,false);
  assert.equal(h.get('entry-tv-hotspot').hidden,true);
  assert.equal(h.get('entry-stage').inert,true);
  h.get('entry-tv-hotspot').listeners.click();assert.equal(h.get('entry-ad-dialog').open,undefined);
  h.finishPrologue(true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.renders.at(-1).text,'하아… 생각만 한다고 달라지는 건 없겠지.\n\n일단 TV나 볼까…? 뭐라도 보고 있으면 좀 나아지려나.');
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
  root.clientWidth=837.5;root.clientHeight=469.5;h.resizeTV();
  assert.equal(tv.style.width,'837.5px');assert.equal(tv.style.left,'0px');assert.equal(tv.style.top,'0px');
  assert.equal(h.get('entry-tv-tutorial').style.left,'416.5px');
  assert.equal(h.get('entry-tv-tutorial').style.top,'232.5px');
  root.clientWidth=400;root.clientHeight=939;h.resizeTV();
  assert.equal(tv.style.width,'1675px');assert.equal(tv.style.left,'-637.5px');assert.equal(tv.style.top,'0px');
  root.clientWidth=1675;root.clientHeight=400;h.resizeTV();
  assert.equal(tv.style.height,'939px');assert.equal(tv.style.top,'-269.5px');
});

test('the TV repeats its click demonstration until the real click without opening the ad automatically',async()=>{
  const h=await setup();const tutorial=h.get('entry-tv-tutorial');
  assert.equal(tutorial.hidden,false);
  assert.equal(tutorial.listeners.animationend,undefined);
  const css=fs.readFileSync(path.join(__dirname,'../public/assets/css/village-theme.css'),'utf8');
  assert.match(css,/animation: entry-tv-demo 3\.2s ease-in-out infinite/);
  assert.match(css,/animation: entry-tv-click 3\.2s ease-out infinite/);
  assert.equal(h.get('entry-ad-dialog').open,undefined);
  assert.equal(h.get('entry-ad-video').plays,undefined);
  h.get('entry-tv-hotspot').listeners.click();assert.equal(h.get('entry-ad-video').plays,1);
  await h.get('entry-ad-video').listeners.ended();assert.equal(tutorial.hidden,true);
});

test('an early TV click or leaving hides the demonstration immediately',async()=>{
  const h=await setup();h.get('entry-tv-hotspot').listeners.click();
  assert.equal(h.get('entry-tv-tutorial').hidden,true);
  const leaving=await setup();leaving.events.pagehide();assert.equal(leaving.get('entry-tv-tutorial').hidden,true);
});

test('clicking the TV opens the ad only once and the old text button is absent',async()=>{
  const h=await setup();const tv=h.get('entry-tv-hotspot'),ad=h.get('entry-ad-video');
  tv.listeners.click();tv.listeners.click();assert.equal(ad.plays,1);assert.equal(tv.hidden,true);
  await ad.listeners.ended();assert.equal(tv.hidden,true);assert.equal(h.get('entry-depart').hidden,false);
  const markup=fs.readFileSync(path.join(__dirname,'../templates/chat.html'),'utf8');
  assert.doesNotMatch(markup,/id="entry-watch"|>TV 보기 ›/);
  assert.match(markup,/<button id="entry-tv-hotspot"[^>]*aria-label="TV를 켜서 광고 보기"/);
});
