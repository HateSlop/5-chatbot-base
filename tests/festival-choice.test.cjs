const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
  let now=0,id=0;const timers=new Map(),calls=[];
  const count={},status={},buttons=['escape','stay'].map(choiceAction=>({dataset:{choiceAction},addEventListener(k,fn){this[k]=fn;},focus(){this.focused=true;}}));
  const events={};
  const dialog={open:false,querySelector:s=>s==='[data-choice-count]'?count:status,querySelectorAll:()=>buttons,addEventListener(k,fn){this[k]=fn;},showModal(){this.open=true;},close(){this.open=false;}};
  const context={window:{addEventListener:(k,fn)=>events[k]=fn},Date:{now:()=>now},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/assets/js/festival-choice.js'),'utf8'),context);
  const ui=new context.window.FestivalChoice(dialog,async action=>{calls.push(action);return true;});
  const tick=async()=>{const [key,timer]=timers.entries().next().value;timers.delete(key);await timer.fn();await Promise.resolve();};
  return {ui,dialog,count,status,buttons,events,calls,timers,tick,clock:value=>now=value};
}
test('the choice clock starts after the final dialogue page, never while reading',async()=>{
  const h=setup();let ready=false;
  h.ui.update({reading:true,ready:()=>ready});
  h.clock(10000);await h.tick();assert.deepEqual(h.calls,[]);
  ready=true;await h.tick();h.clock(11499);await h.tick();assert.deepEqual(h.calls,[]);
  h.clock(11500);await h.tick();assert.deepEqual(h.calls,['begin_final_choice']);
  h.ui.update({deadline:21500});assert.equal(h.dialog.open,true);assert.equal(h.count.textContent,'10');
  h.clock(14500);await h.tick();assert.equal(h.count.textContent,'7');
});
test('choice is submitted once, timer cannot change it during the request, and Escape is blocked',async()=>{
  const h=setup();h.ui.update({deadline:10000});
  const event={preventDefault(){this.prevented=true;}};h.dialog.cancel(event);assert.equal(event.prevented,true);
  await h.buttons[0].click();await h.buttons[1].click();assert.deepEqual(h.calls,['escape']);
  assert.equal(h.buttons.every(b=>b.disabled),true);
  h.ui.update({});assert.equal(h.dialog.open,false);assert.equal(h.timers.size,0);
});
test('timeout catches up after timer delays and failures retry only the timeout',async()=>{
  const h=setup();let attempts=0;
  h.ui.onAction=async action=>{h.calls.push(action);return ++attempts>1;};
  h.ui.update({deadline:10000});h.clock(15000);await h.tick();
  assert.deepEqual(h.calls,['choice_timeout']);assert.equal(h.count.textContent,'0');
  assert.equal(h.buttons.every(b=>b.disabled),true);
  await h.tick();assert.deepEqual(h.calls,['choice_timeout','choice_timeout']);
  assert.equal(h.timers.size,0);
});
test('exit cancels a pending decision and a new play gets a fresh countdown',async()=>{
  const h=setup();h.ui.update({deadline:10000});h.events.pagehide();
  assert.equal(h.timers.size,0);assert.equal(h.dialog.open,false);
  h.clock(20000);h.ui.update({deadline:30000});assert.equal(h.count.textContent,'10');
  h.ui.update({deadline:30000,busy:true});assert.equal(h.buttons.every(b=>b.disabled),true);
  h.ui.update({deadline:30000,busy:false});assert.equal(h.buttons.every(b=>!b.disabled),true);
});
