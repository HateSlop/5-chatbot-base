const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(load=()=>Promise.resolve()) {
  const classes=new Set(),events={};let decodes=0;
  const images=Array.from({length:4},(_,i)=>({dataset:{maleSrc:`male-${i+1}.png`,femaleSrc:`female-${i+1}.png`},decode(){decodes++;return load();}}));
  const root={hidden:true,dataset:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},querySelectorAll:()=>images,focus(){this.focused=true;}};
  const description={};
  const timers=new Map();let timerId=0;
  const context={window:{addEventListener:(k,fn)=>events[k]=fn},document:{getElementById:id=>id==='escape-screen'?root:description},
    setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync('public/assets/js/escape-comic.js','utf8'),context);
  return {ui:context.window.escapeComic,window:context.window,timers,images,root,description,classes,events,decodes:()=>decodes};
}
test('four panels load once, repeated escape renders do not replay, other endings hide the comic',async()=>{
  const h=setup();await h.ui.show(true,'마을을 벗어났다.');
  assert.equal(h.decodes(),4);assert.equal(h.root.hidden,false);assert.equal(h.root.focused,true);
  assert.equal(h.description.textContent,'마을을 벗어났다.');assert.equal(h.classes.has('is-playing'),true);
  await h.ui.show(true);assert.equal(h.decodes(),4);
  await h.ui.show(false);assert.equal(h.root.hidden,true);assert.equal(h.classes.size,0);
  await h.ui.show(true);assert.equal(h.decodes(),8);
});

test('the finale waits for panel loading and reading time; leaving cancels the pending finish',async()=>{
  let ready,finishes=0;const h=setup();
  h.window.endingCinema={finish:()=>finishes++};
  // All panels share the same readiness promise.
  const wait=new Promise(resolve=>ready=resolve);for(const image of h.images) image.decode=()=>wait;
  const playing=h.ui.show(true);assert.equal(h.timers.size,0);ready();await playing;
  assert.equal(h.timers.size,1);const timer=[...h.timers.values()][0];assert.equal(timer.ms,6500);
  timer.fn();assert.equal(finishes,1);
  await h.ui.show(false);assert.equal(h.timers.size,0);timer.fn();assert.equal(finishes,1);
});
test('leaving while images load cancels the reveal; a missing image does not block the other panels',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const h=setup(()=>pending);
  const showing=h.ui.show(true);h.events.pagehide();finish();await showing;
  assert.equal(h.root.hidden,true);assert.equal(h.classes.size,0);
  const broken=setup(()=>Promise.reject(Error('missing')));await broken.ui.show(true);
  assert.equal(broken.root.dataset.loading,'false');assert.equal(broken.classes.has('is-playing'),true);
});

test('the server-selected gender swaps all four images while keeping the same animation',async()=>{
  const h=setup();await h.ui.show(true,'탈출','female');
  assert.deepEqual(h.images.map(i=>i.src),['female-1.png','female-2.png','female-3.png','female-4.png']);
  await h.ui.show(true,'탈출','female');assert.equal(h.decodes(),4);
  await h.ui.show(false);await h.ui.show(true,'탈출','male');
  assert.deepEqual(h.images.map(i=>i.src),['male-1.png','male-2.png','male-3.png','male-4.png']);
  assert.equal(h.decodes(),8);assert.equal(h.classes.has('is-playing'),true);
});
