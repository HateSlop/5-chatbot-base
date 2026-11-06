const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function node(){return {children:[],classList:{add(){},contains(){return false;},remove(){}},attrs:{},append(x){this.children.push(x);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(type,fn){this[type]=fn;},focus(){this.focused=true;},dispatchEvent(){this.inputEvent=true;},insertAdjacentHTML(){}};}
function setup(){
  const nodes=new Map();const querySelector=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);};
  const root={...node(),querySelector,parentNode:{insertBefore(){}}};
  root.querySelector('.move-affinity strong').parentElement={};
  const context={window:{},document:{createElement:()=>({...node(),querySelector})},Event:class{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/post-move-ui.js'),'utf8'),context);
  context.postMoveNavigation=context.window.postMoveNavigation;
  const input=node(),form=node(),send=node();let moved,submissions=0;
  form.requestSubmit=()=>submissions++;
  const ui=new context.window.PostMoveUI(root,form,input,send,id=>moved=id);
  return {ui,input,nodes,send,submissions:()=>submissions,move:()=>moved};
}
test('home renders four slots but only server-provided move actions can run',()=>{
  const h=setup();h.ui.render({locationId:'player_house',locationName:'새집',actions:[{id:'visit_neighbors',kind:'move',label:'이웃 방문'}]});
  const buttons=h.nodes.get('.move-nav').children;
  assert.equal(buttons.length,4);assert.equal(buttons.filter(b=>!b.disabled).length,1);
  buttons[0].click();assert.equal(h.move(),undefined);
  buttons[2].click();assert.equal(h.move(),'visit_neighbors');
  assert.equal(h.nodes.get('.move-affinity strong').textContent,'— / 100');
  assert.equal(h.nodes.get('.move-location').textContent,'새집');
});
test('Enter submits once; Shift+Enter, IME, blank and disabled inputs do not submit',()=>{
  const h=setup();h.input.value='마을은 어때요?';
  const press=options=>{let prevented=false;h.input.keydown({key:'Enter',preventDefault(){prevented=true;},...options});return prevented;};
  assert.equal(press({}),true);assert.equal(h.submissions(),1);
  assert.equal(press({shiftKey:true}),false);assert.equal(press({isComposing:true}),false);assert.equal(press({keyCode:229}),false);
  h.input.value='  ';press({});h.input.value='질문';h.send.disabled=true;press({});h.send.disabled=false;h.input.disabled=true;press({});
  assert.equal(h.submissions(),1);
});
test('return home is gated by server permission and request lock',()=>{
  const h=setup();const data={locationId:'butcher_shop',locationName:'정육점',actions:[{id:'return_home',kind:'move',label:'집으로'}]};
  h.ui.render({...data,busy:true});h.nodes.get('.move-nav').children[0].click();assert.equal(h.move(),undefined);
  h.ui.render(data);h.nodes.get('.move-nav').children[0].click();assert.equal(h.move(),'return_home');
});
test('registered home name is literal text and hints fill a draft without sending',()=>{
  const h=setup();h.ui.render({locationId:'player_house',locationName:'새집',registeredName:'<b>예준</b>',affinity:80});
  assert.equal(h.nodes.get('.move-location').textContent,'<b>예준</b> 하우스');
  assert.equal(h.nodes.get('.move-affinity strong').textContent,'80 / 100');
  assert.equal(h.nodes.get('.move-affinity strong').parentElement.title,'호감도');
  h.nodes.get('.move-hints').children[0].click();assert.equal(h.input.value,'마을에 대해 알려 주세요.');
  assert.equal(h.input.focused,true);assert.equal(h.move(),undefined);
  h.input.disabled=true;h.input.value='유지';h.nodes.get('.move-hints').children[1].click();assert.equal(h.input.value,'유지');
});

test('heart fills from 0 to 100 and unknown affinity stays distinct from zero',()=>{
  const h=setup();const show=affinity=>h.ui.render({locationId:'player_house',locationName:'집',affinity});
  const fill=h.nodes.get('.affinity-fill'),meter=h.nodes.get('.move-affinity');
  for(const [value,height] of [[0,0],[50,46],[100,92]]){
    show(value);assert.equal(Number(fill.attrs.height),height);
    assert.equal(Number(fill.attrs.y),92-height);assert.equal(meter.attrs['aria-valuenow'],String(value));
  }
  show(null);assert.equal(meter.attrs['aria-valuenow'],undefined);
  assert.equal(meter.attrs['aria-valuetext'],'아직 알 수 없음');
  show(120);assert.equal(meter.attrs['aria-valuenow'],'100');
});

test('heart sparkles only on an actual increase or decrease, not initial or repeated scores',()=>{
  const h=setup(),effects=[];
  h.nodes.get('.affinity-heart').animate=(frames)=>effects.push(frames);
  const show=affinity=>h.ui.render({locationId:'player_house',locationName:'집',affinity});
  show(null);show(50);show(50);assert.equal(effects.length,0);
  show(60);assert.equal(effects.length,1);assert.equal(effects[0][1].transform,'scale(1.07)');
  show(40);assert.equal(effects.length,2);assert.equal(effects[1][1].transform,'scale(.96)');
  show(null);show(80);assert.equal(effects.length,2);
});


test('composer starts folded and can be opened, folded and opened by a hint', () => {
  const h = setup();
  assert.equal(h.ui.composerToggle.attrs['aria-expanded'], 'false');
  h.ui.composerToggle.click();
  assert.equal(h.ui.composerToggle.attrs['aria-expanded'], 'true');
  assert.equal(h.input.focused, true);
  h.ui.composerToggle.click();
  assert.equal(h.ui.composerToggle.attrs['aria-expanded'], 'false');
  h.nodes.get('.move-hints').children[0].click();
  assert.equal(h.ui.composerToggle.attrs['aria-expanded'], 'true');
});
