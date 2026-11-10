const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(load=()=>Promise.resolve()) {
  const classes=new Set(),events={};let decodes=0;
  const root={hidden:true,dataset:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},querySelectorAll:()=>Array.from({length:4},()=>({decode(){decodes++;return load();}})),focus(){this.focused=true;}};
  const description={};
  const context={window:{addEventListener:(k,fn)=>events[k]=fn},document:{getElementById:id=>id==='escape-screen'?root:description}};
  vm.runInNewContext(fs.readFileSync('public/assets/js/escape-comic.js','utf8'),context);
  return {ui:context.window.escapeComic,root,description,classes,events,decodes:()=>decodes};
}
test('four panels load once, repeated escape renders do not replay, other endings hide the comic',async()=>{
  const h=setup();await h.ui.show(true,'마을을 벗어났다.');
  assert.equal(h.decodes(),4);assert.equal(h.root.hidden,false);assert.equal(h.root.focused,true);
  assert.equal(h.description.textContent,'마을을 벗어났다.');assert.equal(h.classes.has('is-playing'),true);
  await h.ui.show(true);assert.equal(h.decodes(),4);
  await h.ui.show(false);assert.equal(h.root.hidden,true);assert.equal(h.classes.size,0);
  await h.ui.show(true);assert.equal(h.decodes(),8);
});
test('leaving while images load cancels the reveal; a missing image does not block the other panels',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const h=setup(()=>pending);
  const showing=h.ui.show(true);h.events.pagehide();finish();await showing;
  assert.equal(h.root.hidden,true);assert.equal(h.classes.size,0);
  const broken=setup(()=>Promise.reject(Error('missing')));await broken.ui.show(true);
  assert.equal(broken.root.dataset.loading,'false');assert.equal(broken.classes.has('is-playing'),true);
});
