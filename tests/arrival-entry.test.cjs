const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function setup(){
  const nodes=new Map(),events={},renders=[],timers=new Map();let delay;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,listeners:{},querySelector(){return {decode:async()=>{}};},addEventListener(k,fn){this.listeners[k]=fn;},showModal(){this.open=true;},focus(){this.focused=true;}});return nodes.get(id);};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/arrival-entry.js'),'utf8'),{
    document:{getElementById:get},window:{addEventListener:(k,fn)=>events[k]=fn},
    DialogueStage:class{render(data){renders.push(data);}},PostMoveUI:class{render(){}},
    setTimeout:(fn,ms)=>{delay=ms;timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id),
    fetch(){throw Error('Entry presentation must not create a session');},localStorage:new Proxy({},{get(){throw Error('No storage');}}),
  });
  await new Promise(r=>setImmediate(r));return {get,events,renders,timers,delay};
}
test('live entry waits for background, then Jimmy, with session creation delegated to name form',async()=>{
  const h=await setup();assert.equal(h.renders[0].dialogue,false);assert.equal(h.delay,3000);
  h.timers.get(1)();assert.equal(h.renders.at(-1).speaker,'지미');
  assert.equal(h.get('entry-answer').hidden,false);
  h.get('entry-answer').listeners.click();assert.equal(h.get('entry-name-dialog').open,true);assert.equal(h.get('username').focused,true);
});
test('leaving cancels pending Jimmy appearance',async()=>{
  const h=await setup();h.events.pagehide();assert.equal(h.timers.size,0);
});
