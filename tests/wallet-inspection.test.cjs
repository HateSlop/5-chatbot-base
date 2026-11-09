const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function setup() {
  const nodes=new Map();const events={};const timers=new Map();let id=0;
  const dialog={dataset:{},open:false,querySelector(key){if(!nodes.has(key))nodes.set(key,{addEventListener(k,fn){this[k]=fn;}});return nodes.get(key);},addEventListener(k,fn){this[k]=fn;},showModal(){this.open=true;},close(){this.open=false;}};
  const context={window:{addEventListener:(k,fn)=>events[k]=fn},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/wallet-inspection.js'),'utf8'),context);
  const calls=[];const ui=new context.window.WalletInspection(dialog,async a=>{calls.push(a);return true;});
  return {ui,dialog,nodes,calls,events,timers};
}
test('wallet reveals only after successful actions, photo has its own thought, close never advances',async()=>{
  const h=setup();await h.ui.open();assert.equal(h.dialog.dataset.side,'closed');
  await h.nodes.get('[data-wallet-object]').click();assert.equal(h.dialog.dataset.side,'open');
  await h.nodes.get('[data-wallet-photo]').click();assert.equal(h.dialog.dataset.side,'photo');
  assert.match(h.nodes.get('[data-wallet-image]').src,/wallet_photo/);
  assert.equal(h.nodes.get('[data-wallet-photo]').hidden,true);
  h.nodes.get('[data-wallet-close]').click();assert.equal(h.dialog.open,false);assert.equal(h.timers.size,0);
  assert.deepEqual(h.calls,['inspect_wallet','open_wallet','inspect_wallet_photo']);
  await h.ui.open();assert.equal(h.dialog.dataset.side,'closed');
});
test('failed reveals retry and leaving during a request cannot reopen the dialog',async()=>{
  const h=setup();await h.ui.open();h.ui.onAction=async()=>false;
  await h.ui.reveal('open_wallet','open');assert.equal(h.dialog.dataset.side,'closed');
  assert.equal(h.nodes.get('[data-wallet-object]').disabled,false);
  h.ui.close();let finish;h.ui.onAction=()=>new Promise(resolve=>finish=resolve);
  const opening=h.ui.open();h.events.pagehide();finish(true);await opening;assert.equal(h.dialog.open,false);
});
