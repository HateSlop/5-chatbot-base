const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function setup() {
  const nodes=new Map(); const renders=[]; const ui=[]; const timers=new Map(); const events={};
  let now=0,sequence=0;
  const get=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',open:false,attrs:{},listeners:{},
      addEventListener(type,fn){this.listeners[type]=fn;},removeAttribute(k){delete this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;},
      showModal(){this.open=true;},close(){this.open=false;},querySelector(selector){return get(selector);},decode:async()=>{}});
    return nodes.get(id);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/arrival-preview.js'),'utf8'),{
    document:{getElementById:get},window:{addEventListener:(type,fn)=>events[type]=fn},
    DialogueStage:class{render(data){renders.push(data);get('.dialogue-box').hidden=get('.move-composer').hidden=data.dialogue===false;}},PostMoveUI:class{render(data){ui.push(data);}},
    setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),
    fetch(){throw Error('No API calls allowed');},localStorage:new Proxy({},{get(){throw Error('No storage access allowed');}}),
  });
  const settle=()=>new Promise(r=>setImmediate(r)); await settle();
  return {get,renders,ui,events,timers,settle,
    advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.due<=now){timers.delete(id);t.fn();}},
    submit(name){get('arrival-name').value=name;get('arrival-name-form').listeners.submit({preventDefault(){}});},
    openName(){get('arrival-answer').listeners.click();},
  };
}
test('Jimmy appears at 3 seconds; question stays in dialogue until the user opens naming',async()=>{
  const h=await setup(); assert.equal(h.renders.at(-1).image,undefined);
  for(const id of ['.dialogue-box','.move-composer','arrival-chat'])assert.equal(h.get(id).hidden,true);
  h.advance(2999);assert.equal(h.get('arrival-name-dialog').open,false);
  assert.equal(h.get('.dialogue-box').hidden,true);
  h.advance(1);assert.equal(h.renders.at(-1).speaker,'지미');
  assert.equal(h.renders.at(-1).text,'더뉴빌리지에 온 걸 환영해. 여기 진짜 끝내주는 곳이거든! 아 참, 너의 이름은 뭐야?');
  assert.equal(h.renders.at(-1).image,'/assets/images/jimmy_smile.svg');
  for(const id of ['.dialogue-box','.move-composer','arrival-chat'])assert.equal(h.get(id).hidden,false);
  assert.equal(h.get('arrival-name-dialog').open,false);
  assert.equal(h.get('arrival-answer').hidden,false);
  h.openName();
  assert.equal(h.get('arrival-name-dialog').open,true);assert.equal(h.get('arrival-name').focused,true);
});
test('invalid names keep the modal open; accepted names are literal text and appear in greeting',async()=>{
  const h=await setup();h.advance(3000);h.openName();
  for(const name of ['', '  ', '가'.repeat(51)]){h.submit(name);assert.equal(h.get('arrival-name-dialog').open,true);assert.equal(h.get('arrival-name').attrs['aria-invalid'],'true');}
  h.submit('  <b>예준</b>  ');
  assert.equal(h.get('arrival-name-dialog').open,false);
  assert.equal(h.renders.at(-1).text,'그래 <b>예준</b>이구나! 반가워! 잘 지내보자.');
  assert.equal(h.ui.at(-1).registeredName,'<b>예준</b>');assert.equal(h.get('arrival-message').disabled,false);
  const count=h.renders.length;h.submit('중복');assert.equal(h.renders.length,count);
});
test('50-character name is accepted and Escape does not abandon naming',async()=>{
  const h=await setup();h.advance(3000);h.openName();let prevented=false;
  h.get('arrival-name-dialog').listeners.cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  h.submit('가'.repeat(50));assert.equal(h.get('arrival-name-dialog').open,false);
});
test('replay cancels the old timer; leaving the page cancels pending appearance',async()=>{
  const h=await setup();h.advance(2000);h.get('arrival-replay').listeners.click();await h.settle();
  assert.equal(h.timers.size,1);h.advance(1000);assert.equal(h.get('arrival-name-dialog').open,false);
  h.advance(2000);assert.equal(h.get('arrival-answer').hidden,false);h.openName();assert.equal(h.get('arrival-name-dialog').open,true);
  h.get('arrival-replay').listeners.click();await h.settle();h.events.pagehide();h.advance(3000);
  assert.equal(h.get('arrival-name-dialog').open,false);
  h.events.pageshow({persisted:true});await h.settle();h.advance(3000);
  assert.equal(h.get('arrival-answer').hidden,false);
  assert.equal(h.get('arrival-name-dialog').open,false);
});
