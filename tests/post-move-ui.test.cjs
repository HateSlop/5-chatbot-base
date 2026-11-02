const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function node(){return {children:[],classList:{add(){},contains(){return false;},remove(){}},attrs:{},append(x){this.children.push(x);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,fn){this[type]=fn;},focus(){this.focused=true;},dispatchEvent(){this.inputEvent=true;},insertAdjacentHTML(){}};}
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
  assert.equal(h.nodes.get('.move-affinity strong').parentElement.title,'마을 호감도');
  h.nodes.get('.move-hints').children[0].click();assert.equal(h.input.value,'마을에 대해 알려 주세요.');
  assert.equal(h.input.focused,true);assert.equal(h.move(),undefined);
  h.input.disabled=true;h.input.value='유지';h.nodes.get('.move-hints').children[1].click();assert.equal(h.input.value,'유지');
});
