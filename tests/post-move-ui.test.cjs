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
  const h=setup();h.ui.render({sceneId:'arrival',locationId:'player_house',locationName:'새집',characterId:'jimmy',canChat:true,registeredName:'<b>예준</b>',affinity:80});
  assert.equal(h.nodes.get('.move-location').textContent,'<b>예준</b> 하우스');
  assert.equal(h.nodes.get('.move-affinity strong').textContent,'80 / 100');
  assert.equal(h.nodes.get('.move-affinity strong').parentElement.title,'호감도');
  assert.equal(h.nodes.get('.move-hints').children.length,3);
  h.nodes.get('.move-hints').children[0].click();assert.equal(h.input.value,'이 마을은 어떤 곳이야?');
  assert.equal(h.input.focused,true);assert.equal(h.move(),undefined);
  assert.equal(h.submissions(),0);
  h.input.disabled=true;h.input.value='유지';h.nodes.get('.move-hints').children[1].click();assert.equal(h.input.value,'유지');
});

test('profile uses the selected portrait and server-provided name, date and job',()=>{
  const h=setup();
  h.ui.render({locationId:'player_house',locationName:'새집',registeredName:'<b>새 이름</b>',gender:'male',today:'2월 28일',job:null});
  assert.equal(h.nodes.get('.player-name').textContent,'<b>새 이름</b>');
  assert.equal(h.nodes.get('.player-today').textContent,'2월 28일');
  assert.equal(h.nodes.get('.player-job').textContent,'미정');
  assert.equal(h.nodes.get('.player-photo').attrs['data-gender'],'male');
  assert.equal(h.nodes.get('.player-photo').src,'/assets/images/player_male.png');
  h.ui.render({locationId:'player_house',locationName:'새집',registeredName:'새 이름',gender:'female',today:'3월 1일',job:'gardener'});
  assert.equal(h.nodes.get('.player-today').textContent,'3월 1일');
  assert.equal(h.nodes.get('.player-job').textContent,'정원사');
  assert.equal(h.nodes.get('.player-photo').attrs['data-gender'],'female');
  assert.equal(h.nodes.get('.player-photo').src,'/assets/images/player_female.png');
  h.ui.render({locationId:'player_house',locationName:'새집',registeredName:'새 이름',gender:'female',today:'3월 2일',job:'driver'});
  assert.equal(h.nodes.get('.player-job').textContent,'트럭 운전수');
  h.ui.render({locationId:'player_house',locationName:'새집',registeredName:'새 이름',gender:'female',today:'3월 2일',job:null});
  assert.equal(h.nodes.get('.player-job').textContent,'미정');
});

test('suggestions follow the scene, place and speaker without revealing future clues',()=>{
  const h=setup();
  const cases=[
    ['neighbors','karen_house','karen','주민대표'],
    ['neighbors','butcher_shop','bob','정육점'],
    ['neighbors','salon','cathy','미용실'],
    ['cathy_task','player_house','jimmy','캐시'],
    ['jimmy_butcher','player_house','jimmy','정육점'],
    ['karen_search','player_house','karen','지미'],
    ['butcher_search','butcher_shop','jimmy','괜찮아'],
    ['dinner_invite','player_house','jimmy','몇 시'],
    ['checkpoint','player_house','karen','무슨 일'],
    ['festival_invite','player_house','bob','축제'],
  ];
  for(const [sceneId,locationId,characterId,word] of cases){
    h.ui.render({sceneId,locationId,locationName:locationId,characterId,canChat:true});
    const questions=h.nodes.get('.move-hints').children.map(button=>button.textContent);
    assert.ok(questions.length>=2 && questions.length<=3,sceneId);
    assert.ok(questions.some(question=>question.includes(word)),sceneId);
    assert.ok(questions.every(question=>!/(실종|식인|머리카락|화로|수첩|비밀)/.test(question)),sceneId);
  }
  h.input.value='내가 직접 쓴 질문';
  h.ui.render({sceneId:'checkpoint',locationId:'player_house',locationName:'집',characterId:'karen',canChat:true});
  assert.equal(h.input.value,'내가 직접 쓴 질문');
  assert.equal(h.submissions(),0);
});

test('scenes without a speaker show guidance instead of clickable questions',()=>{
  const h=setup();
  for(const [sceneId,locationId,guide] of [
    ['neighbors','square','방문할 이웃'],
    ['cathy_help','salon','바구니'],
    ['empty_butcher','butcher_shop','열린 문'],
    ['basement','basement','지갑'],
    ['photo_found','karen_house','사진'],
    ['wait_dinner','player_house','혼자'],
    ['hair_found','square','화면의 물건이나 행동'],
  ]){
    h.ui.render({sceneId,locationId,locationName:locationId,canChat:false});
    assert.equal(h.nodes.get('.move-hints').children.length,0,sceneId);
    assert.ok(h.nodes.get('.move-hint-caption').textContent.includes(guide),sceneId);
  }
  h.ui.render({sceneId:'basement',locationId:'basement',locationName:'지하실',actions:[{id:'go_upstairs',kind:'move'}]});
  assert.match(h.nodes.get('.move-hint-caption').textContent,/지갑.*지하실에서 나가/);
  h.ui.render({sceneId:'photo_found',locationId:'karen_house',locationName:'캐런 집',actions:[{id:'return_home',kind:'move'}]});
  assert.match(h.nodes.get('.move-hint-caption').textContent,/집으로 돌아가/);
  h.input.disabled=true;
  h.ui.render({sceneId:'arrival',locationId:'player_house',locationName:'집',characterId:'jimmy',canChat:true});
  assert.equal(h.nodes.get('.move-hints').children[0].disabled,true);
});

test('heart fills from 0 to 100 and unknown affinity stays distinct from zero',()=>{
  const h=setup();const show=affinity=>h.ui.render({locationId:'player_house',locationName:'집',affinity});
  const fill=h.nodes.get('.affinity-fill'),meter=h.nodes.get('.move-affinity');
  for(const [value,height] of [[0,0],[50,46],[100,92]]){
    show(value);assert.equal(Number(fill.attrs.height),height);
    assert.equal(h.nodes.get('.affinity-liquid').attrs.transform,`translate(0 ${92-height})`);
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


test('composer stays open and suggestions fill the visible input', () => {
  const h = setup();
  const composer = h.nodes.get('.move-composer');
  assert.equal(composer.children.length, 1);
  assert.equal(composer.children[0].hidden, false);
  h.ui.render({sceneId:'arrival',locationId:'player_house',locationName:'집',characterId:'jimmy',canChat:true});
  h.nodes.get('.move-hints').children[0].click();
  assert.equal(h.input.focused, true);
  h.input.disabled = true;
  h.ui.render({locationId:'basement',locationName:'지하실'});
  assert.equal(composer.children[0].hidden, false);
});
