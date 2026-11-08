const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function setup(){
  const nodes=new Map(),events={},renders=[],timers=new Map();let delay;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,listeners:{},querySelector(){return {decode:async()=>{}};},addEventListener(k,fn){this.listeners[k]=fn;},showModal(){this.open=true;},close(){this.open=false;},pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();},focus(){this.focused=true;}});return nodes.get(id);};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/arrival-entry.js'),'utf8'),{
    document:{getElementById:get},window:{addEventListener:(k,fn)=>events[k]=fn},
    DialogueStage:class{render(data){renders.push(data);}},PostMoveUI:class{render(){} setSplit(){}},
    setTimeout:(fn,ms)=>{delay=ms;timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id),
    fetch(){throw Error('Entry presentation must not create a session');},localStorage:new Proxy({},{get(){throw Error('No storage');}}),
  });
  await new Promise(r=>setImmediate(r));return {get,events,renders,timers,get delay(){return delay;}};
}
test('live entry begins at the pre-move house, then waits for Jimmy after departure',async()=>{
  const h=await setup();assert.equal(h.renders[0].background,'/assets/images/pre-move-house.png');
  assert.equal(h.renders[0].speaker,'');assert.equal(h.renders[0].text,'티비나 볼까?');
  assert.equal(h.get('entry-depart').hidden,true);
  h.get('entry-watch').listeners.click();
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
  h.get('entry-watch').listeners.click();await new Promise(r=>setImmediate(r));
  assert.equal(h.get('entry-ad-retry').hidden,false);
  assert.equal(h.get('entry-depart').hidden,true);
  h.get('entry-ad-video').listeners.error();assert.equal(h.get('entry-ad-continue').hidden,false);
  await h.get('entry-ad-continue').listeners.click();
  assert.equal(h.renders.at(-1).text,'저기로 갈까?');
  assert.equal(h.get('entry-ad-dialog').open,false);
});
