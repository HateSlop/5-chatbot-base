const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(backgroundReady=Promise.resolve()) {
  let now=0,id=0;const timers=new Map(),calls=[],events={};
  const door={style:{},addEventListener(k,fn){this[k]=fn;}},count={};
  const counter={querySelector:()=>count};
  const root={clientWidth:960,clientHeight:720,dataset:{dialogueComplete:'false'}};
  const context={window:{addEventListener:(k,fn)=>events[k]=fn},document:{getElementById:id=>id==='truck-door-hotspot'?door:counter},Date:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync('public/assets/js/truck-escape.js','utf8'),context);
  const ui=new context.window.TruckEscape(root,async action=>{calls.push(action);return true;},{backgroundReady});
  const tick=async()=>{const [key,timer]=timers.entries().next().value;timers.delete(key);await timer.fn();};
  return {ui,root,door,counter,count,calls,timers,events,tick,clock:n=>now=n};
}
const view=deadline=>({scene_id:'truck_escape',truck_deadline:deadline});
test('the ten seconds start only after the background loads; exit cancels the pending start',async()=>{
  let loaded;const h=setup(new Promise(resolve=>loaded=resolve));
  h.ui.update(view(null),false);h.clock(50000);assert.deepEqual(h.calls,[]);assert.equal(h.door.disabled,true);
  h.ui.onAction=async a=>{h.calls.push(a);h.ui.update(view(60000),false);return true;};
  loaded();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.calls,['begin_truck_escape']);
  await h.tick();assert.equal(h.count.textContent,'10');assert.equal(h.door.disabled,false);
  let finish;const left=setup(new Promise(resolve=>finish=resolve));left.ui.update(view(null),false);left.events.pagehide();finish();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(left.calls,[]);assert.equal(left.timers.size,0);
});
test('locked door replies retain the clock and timeout retries without extending it',async()=>{
  const h=setup();h.ui.update(view(10000),false);
  await h.door.click();assert.deepEqual(h.calls,['open_truck_door']);
  h.clock(9000);await h.tick();assert.equal(h.count.textContent,'1');
  let attempts=0;h.ui.onAction=async a=>{h.calls.push(a);return ++attempts>1;};
  h.clock(10000);await h.tick();assert.equal(h.door.disabled,true);assert.equal(h.calls.at(-1),'truck_timeout');
  h.clock(10500);await h.tick();assert.equal(attempts,1);
  h.clock(11000);await h.tick();assert.equal(attempts,2);
  h.ui.update({scene_id:'ending'},false);assert.equal(h.counter.hidden,true);assert.equal(h.timers.size,0);
});
test('the result stays until typing completes plus reading time, then advances once',async()=>{
  const h=setup();h.ui.update({scene_id:'truck_escape_result'},false);h.clock(10000);await h.tick();assert.deepEqual(h.calls,[]);
  h.root.dataset.dialogueComplete='true';await h.tick();h.clock(11499);await h.tick();assert.deepEqual(h.calls,[]);
  h.ui.onAction=async a=>{h.calls.push(a);h.ui.update({scene_id:'ending'},false);return true;};
  h.clock(11500);await h.tick();assert.deepEqual(h.calls,['finish_truck_escape']);assert.equal(h.timers.size,0);
});
