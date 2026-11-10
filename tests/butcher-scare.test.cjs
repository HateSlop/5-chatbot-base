const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(decode=()=>Promise.resolve()) {
  const events={},timers=new Map();let id=0;
  const root={hidden:true,dataset:{},focus(){this.focused=true;},querySelectorAll:()=>Array.from({length:3},()=>({decode}))};
  const window={addEventListener:(name,fn)=>events[name]=fn};
  vm.runInNewContext(fs.readFileSync('public/assets/js/butcher-scare.js','utf8'),{
    window,document:{getElementById:()=>root},
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  });
  const tick=async()=>{const [id,timer]=timers.entries().next().value;timers.delete(id);timer.fn();await new Promise(setImmediate);};
  return {ui:window.butcherScare,root,events,timers,tick};
}
test('all images prepare before standing Bob, then black, lunge, fading blackout and the death film',async()=>{
  let ready;const load=new Promise(resolve=>ready=resolve),h=setup(()=>load);
  const playing=h.ui.play();assert.equal(h.root.hidden,true);assert.equal(h.timers.size,0);
  ready();await new Promise(setImmediate);
  assert.equal(h.root.dataset.phase,'arrival');assert.equal(h.root.hidden,false);
  assert.equal([...h.timers.values()][0].ms,2400);await h.tick();assert.equal(h.root.dataset.phase,'black');
  assert.equal([...h.timers.values()][0].ms,850);await h.tick();assert.equal(h.root.dataset.phase,'attack');
  assert.equal([...h.timers.values()][0].ms,1500);await h.tick();assert.equal(h.root.dataset.phase,'fade');
  assert.equal([...h.timers.values()][0].ms,650);
  await h.tick();assert.equal(await playing,true);assert.equal(h.root.hidden,true);
});
test('leaving during loading or any visible phase cancels the surprise and pending video start',async()=>{
  for(const phase of ['loading','arrival','black','attack','fade']) {
    let ready;const load=new Promise(resolve=>ready=resolve),h=setup(()=>load);
    const playing=h.ui.play();
    if(phase!=='loading') {ready();await new Promise(setImmediate);}
    if(['black','attack','fade'].includes(phase)) await h.tick();
    if(['attack','fade'].includes(phase)) await h.tick();
    if(phase==='fade') await h.tick();
    h.events.pagehide();ready();assert.equal(await playing,false);
    assert.equal(h.timers.size,0);assert.equal(h.root.hidden,true);
  }
});
test('a broken image skips the surprise and allows the existing death film fallback',async()=>{
  const h=setup(()=>Promise.reject(Error('missing')));
  assert.equal(await h.ui.play(),true);assert.equal(h.root.hidden,true);
});
