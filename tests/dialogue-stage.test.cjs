const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(extra = {}) {
  const nodes = {};
  for (const name of ['background','figure','tv','speaker','text','box']) {
    nodes[`.dialogue-${name}`] = {hidden: true, textContent: '', removeAttribute(key) {delete this[key];}};
  }
  nodes['.move-composer']={hidden:false};
  const context = {window: {}, ...extra};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/assets/js/dialogue-stage.js'),'utf8'), context);
  const stage = new context.window.DialogueStage({dataset:{},querySelector: s=>nodes[s]});
  stage.pause = async () => {};
  return {nodes, stage};
}

test('disclosed frightened Jimmy and caught Karen scenes keep their incident portraits', async () => {
  const {nodes, stage} = setup();
  for (const sceneId of ['butcher_search']) {
    stage.render({sceneId, background:'/assets/images/butcher_shop.svg', image:'/assets/images/jimmy_neutral.svg'});
    await stage.ready;
    assert.equal(nodes['.dialogue-figure'].src, '/assets/images/jimmy_scared.png');
  }
  stage.render({sceneId:'photo_found', background:'/assets/images/karen_house.svg', image:'/assets/images/karen_worried.svg'});
  await stage.ready;
  assert.equal(nodes['.dialogue-figure'].src, '/assets/images/karen_angry.png');
});

test('Jimmy keeps the anxious cutout throughout the dinner invitation', async () => {
  const {nodes, stage} = setup();
  for (const image of ['jimmy_neutral.svg', 'jimmy_smile.png', 'jimmy_angry.png', 'jimmy_anxiety.png']) {
    stage.render({sceneId:'dinner_invite', background:'/assets/images/player_house.svg', image:`/assets/images/${image}`, visitorId:'jimmy'});
    await stage.ready;
    assert.equal(nodes['.dialogue-figure'].src, '/assets/images/jimmy_anxiety.png');
    assert.equal(stage.root.dataset.figure, 'jimmy');
  }
});

test('Jimmy leaves the empty butcher scene while his farewell and background remain', async () => {
  const {nodes, stage} = setup();
  stage.render({sceneId:'butcher_search', background:'/assets/images/butcher_shop.svg', image:'/assets/images/jimmy_neutral.svg'});
  await stage.ready;
  const farewell = {sceneId:'empty_butcher', background:'/assets/images/butcher_shop.svg',
    image:'/assets/images/jimmy_worried.svg', speaker:'지미', text:'지금은 말할 수 없어. 나중에 보자.'};
  for (let i = 0; i < 2; i++) {
    stage.render(farewell);
    await stage.ready;
    assert.equal(nodes['.dialogue-figure'].hidden, true);
    assert.equal(nodes['.dialogue-figure'].src, undefined);
    assert.equal(nodes['.dialogue-background'].src, '/assets/images/butcher_shop.svg');
    assert.equal(nodes['.dialogue-text'].textContent, farewell.text);
  }
});
test('separate speaker/text remain literal text, including markup and long dialogue',()=>{
  const {nodes,stage}=setup();
  const text='<img src=x onerror=alert(1)>'.repeat(300);
  stage.render({speaker:'<b>내 이름</b>',text,object:'tv'});
  assert.equal(nodes['.dialogue-speaker'].textContent,'<b>내 이름</b>: ');
  assert.equal(nodes['.dialogue-text'].textContent,text);
  assert.equal(nodes['.dialogue-tv'].hidden,false);
  assert.equal(nodes['.dialogue-figure'].hidden,true);
});
test('background readiness gates both dialogue and composer, and silent scenes keep them hidden',async()=>{
  const {nodes,stage}=setup();let resolve;
  nodes['.dialogue-background'].decode=()=>new Promise(r=>resolve=r);
  stage.render({background:'/room.svg',speaker:'지미',text:'질문'});
  assert.equal(nodes['.dialogue-box'].hidden,true);assert.equal(nodes['.move-composer'].hidden,true);
  resolve();await stage.ready;
  assert.equal(nodes['.dialogue-box'].hidden,false);assert.equal(nodes['.move-composer'].hidden,false);
  stage.render({dialogue:false});await stage.ready;
  assert.equal(nodes['.dialogue-box'].hidden,true);assert.equal(nodes['.move-composer'].hidden,true);
});
test('a stale background load cannot reveal a newer waiting scene',async()=>{
  const {nodes,stage}=setup();let resolve;
  nodes['.dialogue-background'].decode=()=>new Promise(r=>resolve=r);
  stage.render({background:'/old.svg',text:'이전 대사'});const old=stage.ready;
  stage.render({dialogue:false});await stage.ready;resolve();await old;
  assert.equal(nodes['.dialogue-box'].hidden,true);assert.equal(nodes['.move-composer'].hidden,true);
});
test('missing assets stay hidden and a failed TV replacement restores CSS TV',()=>{
  const {nodes,stage}=setup();
  stage.render({image:'/missing', background:'/missing-background',object:'tv'});
  nodes['.dialogue-figure'].onerror(); nodes['.dialogue-background'].onerror();
  assert.equal(nodes['.dialogue-figure'].hidden,true);
  assert.equal(nodes['.dialogue-background'].hidden,true);
  assert.equal(nodes['.dialogue-tv'].hidden,false);
  stage.render({speaker:'밥',image:'/bob.svg'});
  nodes['.dialogue-figure'].onload();
  assert.equal(nodes['.dialogue-figure'].hidden,false);
  assert.equal(nodes['.dialogue-tv'].hidden,true);
  stage.render({});
  assert.equal(nodes['.dialogue-figure'].hidden,true);
  assert.equal(nodes['.dialogue-figure'].src,undefined);
});

test('home visit shows open door, then Jimmy, then dialogue; replies do not replay arrival',async()=>{
  const {nodes,stage}=setup();const pauses=[];
  stage.pause=ms=>new Promise(resolve=>pauses.push({ms,resolve}));
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  stage.render({background:'/assets/images/player_house.svg',dialogue:false});await stage.ready;
  stage.render({background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_smile.svg',speaker:'지미',text:'질문'});
  await settle();
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/player_house_open.png');
  assert.equal(nodes['.dialogue-figure'].hidden,true);
  assert.equal(nodes['.dialogue-box'].hidden,true);
  assert.equal(pauses[0].ms,1000);pauses.shift().resolve();await settle();
  assert.equal(nodes['.dialogue-figure'].src,'/assets/images/jimmy_smile.png');
  assert.equal(nodes['.dialogue-box'].hidden,true);
  assert.equal(nodes['.move-composer'].hidden,true);
  assert.equal(pauses[0].ms,400);pauses.shift().resolve();await stage.ready;
  assert.equal(nodes['.dialogue-box'].hidden,false);
  assert.equal(nodes['.move-composer'].hidden,false);
  stage.render({background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_worried.svg',speaker:'지미',text:'답변'});
  assert.equal(nodes['.dialogue-box'].hidden,false);
  assert.equal(nodes['.move-composer'].hidden,false);
  await stage.ready;
  assert.equal(pauses.length,0);
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/player_house_open.png');
});

test('replacement images keep the old background visible until decoding finishes',async()=>{
  const pending=[];
  const {nodes,stage}=setup({Image:class {constructor(){pending.push(this);}decode(){return Promise.resolve();}}});
  const bg=nodes['.dialogue-background'];bg.src='/closed.png';bg.hidden=false;
  const ready=stage.image(bg,'/open.png','열린 문');
  assert.equal(bg.src,'/closed.png');assert.equal(bg.hidden,false);
  await pending[0].onload();await ready;
  assert.equal(bg.src,'/open.png');assert.equal(bg.hidden,false);
});

test('location label is released with each background before the dialogue delay', async () => {
  const pending = [];
  const {nodes, stage} = setup({Image:class {constructor() { pending.push(this); } decode() { return Promise.resolve(); }}});
  const pauses = [];
  stage.pause = ms => new Promise(resolve => pauses.push({ms, resolve}));
  for (const place of ['player_house', 'karen_house', 'butcher_shop', 'salon', 'square', 'basement']) {
    const background = `/assets/images/${place}.svg`;
    stage.render({background, text:'현재 장면'});
    assert.equal(stage.root.dataset.backgroundReady, 'false');
    await pending.shift().onload();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(nodes['.dialogue-background'].src, background);
    assert.equal(stage.root.dataset.backgroundReady, 'true');
    assert.equal(nodes['.dialogue-box'].hidden, true);
    assert.equal(pauses[0].ms, 400);
    pauses.shift().resolve();
    await stage.ready;
  }
});

test('continuous Jimmy dialogue keeps panels visible and preserves the requested emotion',async()=>{
  const {nodes,stage}=setup();stage.homeVisitor='jimmy';stage.visitorVisible=true;
  stage.render({background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_basic.png',text:'인사'});await stage.ready;
  stage.render({background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_angry.png',text:'응답'});
  assert.equal(nodes['.dialogue-box'].hidden,false);
  assert.equal(nodes['.move-composer'].hidden,false);
  await stage.ready;
  assert.equal(nodes['.dialogue-figure'].src,'/assets/images/jimmy_angry.png');
});

test('each resident shakes once on a visible smile-to-anger transition, not repeated renders or first appearances', async () => {
  for (const id of ['jimmy', 'karen', 'bob', 'cathy']) {
    const {nodes, stage} = setup();
    let shakes = 0;
    nodes['.dialogue-figure'].animate = (_, options) => {
      ++shakes;
      assert.equal(options.duration, 360);
      return {cancel() {}};
    };
    const scene = image => ({background:'/assets/images/salon.svg', image:`/assets/images/${id}_${image}.png`});
    stage.render(scene('angry')); await stage.ready;
    assert.equal(shakes, 0);
    stage.render(scene('smile')); await stage.ready;
    stage.render(scene('angry')); const first = stage.ready;
    stage.render(scene('angry')); await first; await stage.ready;
    assert.equal(shakes, 1);
    stage.render(scene('angry')); await stage.ready;
    assert.equal(shakes, 1);
    stage.render(scene('smile')); await stage.ready;
    stage.render(scene('angry')); await stage.ready;
    assert.equal(shakes, 2);
    stage.render({background:'/square.svg'}); await stage.ready;
    stage.render(scene('angry')); await stage.ready;
    assert.equal(shakes, 2);
  }
});

test('anger shaking respects reduced motion and does not carry across residents', async () => {
  const {nodes, stage} = setup({window:{matchMedia:() => ({matches:true})}});
  let shakes = 0;
  nodes['.dialogue-figure'].animate = () => { ++shakes; };
  stage.render({image:'/assets/images/karen_smile.png'}); await stage.ready;
  stage.render({image:'/assets/images/karen_angry.png'}); await stage.ready;
  assert.equal(shakes, 0);
  const other = setup();
  other.nodes['.dialogue-figure'].animate = () => { ++shakes; };
  other.stage.render({image:'/assets/images/karen_smile.png'}); await other.stage.ready;
  other.stage.render({image:'/assets/images/bob_angry.png'}); await other.stage.ready;
  assert.equal(shakes, 0);
});

test('leaving during door opening cannot reveal Jimmy or dialogue over another scene',async()=>{
  const {nodes,stage}=setup();let release;
  stage.pause=()=>new Promise(resolve=>release=resolve);
  stage.render({background:'/assets/images/player_house.svg',dialogue:false});await stage.ready;
  stage.render({background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_neutral.svg'});const previous=stage.ready;
  await new Promise(resolve=>setImmediate(resolve));
  stage.render({background:'/square.svg',dialogue:false});await stage.ready;
  release();await previous;
  assert.equal(nodes['.dialogue-background'].src,'/square.svg');
  assert.equal(nodes['.dialogue-figure'].hidden,true);
  assert.equal(nodes['.dialogue-box'].hidden,true);
});

test('leaving home resets the visit; both Jimmy and later characters enter through the door',async()=>{
  const {nodes,stage}=setup();const pauses=[];
  stage.pause=async ms=>{pauses.push(ms);};
  const home='/assets/images/player_house.svg';
  stage.render({background:home,image:'/assets/images/jimmy_basic.png',visitorId:'jimmy'});await stage.ready;
  assert.deepEqual(pauses,[1500,1000,400]);pauses.length=0;
  stage.render({background:home,image:'/assets/images/jimmy_smile.png',visitorId:'jimmy'});await stage.ready;
  assert.deepEqual(pauses,[]);
  stage.render({background:'/assets/images/butcher_shop.svg',image:'/assets/images/bob_neutral.svg',visitorId:'bob'});await stage.ready;
  assert.equal(stage.homeVisitor,null);
  pauses.length=0;
  stage.render({background:home,image:'/assets/images/jimmy_basic.png',visitorId:'jimmy',text:'새 방문'});
  assert.equal(nodes['.dialogue-background'].src,home);
  assert.equal(nodes['.dialogue-figure'].hidden,true);
  assert.equal(nodes['.dialogue-box'].hidden,true);
  await stage.ready;assert.deepEqual(pauses,[1500,1000,400]);pauses.length=0;
  stage.render({background:'/square.svg'});await stage.ready;
  pauses.length=0;
  stage.render({background:home,image:'/assets/images/karen_neutral.svg',visitorId:'karen',speaker:'캐런'});await stage.ready;
  assert.deepEqual(pauses,[1500,1000,400]);
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/player_house_open.png');
  assert.equal(nodes['.dialogue-figure'].src,'/assets/images/karen_basic.png');
});

test('a new location reveals its dialogue only after background and character are visible',async()=>{
  const {nodes,stage}=setup();let release;
  const delays=[]; stage.pause=ms=>{delays.push(ms);return new Promise(resolve=>release=resolve);};
  stage.render({background:'/salon.svg',image:'/cathy.svg',speaker:'캐시',text:'대사'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stage.root.dataset.loading,'true');
  assert.deepEqual(delays,[1000]);
  release();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stage.root.dataset.loading,'false');
  assert.equal(nodes['.dialogue-box'].hidden,true);
  assert.equal(nodes['.move-composer'].hidden,true);
  release();await stage.ready;
  assert.equal(nodes['.dialogue-box'].hidden,false);
});

test('every character keeps the dialogue delay when an entrance is rendered again', async () => {
  for (const character of ['jimmy', 'karen', 'bob', 'cathy']) {
    const {nodes, stage} = setup();
    const pauses = [];
    stage.pause = ms => new Promise(resolve => pauses.push({ms, resolve}));
    const settle = () => new Promise(resolve => setImmediate(resolve));
    const scene = {background:'/shop.svg', image:`/${character}.png`, speaker:character, text:'대사'};
    stage.render(scene);
    await settle();
    const old = stage.ready;
    stage.render(scene);
    await settle();
    for (const pause of pauses.splice(0)) { assert.equal(pause.ms, 1000); pause.resolve(); }
    await settle();
    assert.equal(await old, false);
    assert.equal(stage.root.dataset.loading, 'false');
    assert.equal(nodes['.dialogue-box'].hidden, true);
    assert.equal(pauses[0].ms, 400);
    pauses.shift().resolve();
    await stage.ready;
    assert.equal(nodes['.dialogue-box'].hidden, false);
    stage.render(scene);
    await stage.ready;
    assert.equal(pauses.length, 0);
  }
});

test('long dialogue pages preserve every character without scroll or HTML interpretation',()=>{
  const {nodes,stage}=setup();let paged=false;
  stage.pager={hidden:true};stage.previous={};stage.next={};stage.pageLabel={};
  stage.box.hidden=false;stage.box.clientHeight=100;
  stage.box.classList={add(){paged=true;},remove(){paged=false;}};
  Object.defineProperty(stage.box,'scrollHeight',{get(){return Math.max(100,Array.from(nodes['.dialogue-text'].textContent).length+(paged?40:0));}});
  stage.fullText='<b>그대로 읽는 대사 😀</b>'.repeat(30);
  stage.layoutPages();
  assert.equal(stage.pages.join(''),stage.fullText);
  assert.ok(stage.pages.length>1);
  assert.equal(stage.previous.disabled,true);assert.equal(stage.next.disabled,false);
  assert.ok(stage.box.scrollHeight<=stage.box.clientHeight);
  stage.pageIndex=stage.pages.length-1;stage.showPage();
  assert.equal(stage.next.disabled,true);assert.equal(stage.previous.disabled,false);
});

test('the secret room is selected only for the disclosed photo_found scene',async()=>{
  const {nodes,stage}=setup();
  stage.render({background:'/assets/images/karen_house.svg',sceneId:'karen_dinner'});await stage.ready;
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/karen_house.svg');
  stage.render({background:'/assets/images/karen_house.svg',sceneId:'photo_found'});await stage.ready;
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/karen_secret_room_angle2.png');
});

test('a server response followed by its final render cannot skip a pending home entrance',async()=>{
  const {nodes,stage}=setup();const pauses=[];
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  stage.pause=ms=>new Promise(resolve=>pauses.push({ms,resolve}));
  const visit={background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_basic.png',visitorId:'jimmy',text:'부탁'};
  stage.render(visit);const first=stage.ready;await settle();
  assert.equal(pauses[0].ms,1500);
  stage.render(visit);const final=stage.ready;await settle();
  assert.equal(nodes['.dialogue-box'].hidden,true);
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/player_house.svg');
  assert.equal(pauses[1].ms,1500);
  pauses.shift().resolve();await first;
  pauses.shift().resolve();await settle();
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/player_house_open.png');
  assert.equal(pauses[0].ms,1000);pauses.shift().resolve();await settle();
  assert.equal(pauses[0].ms,400);pauses.shift().resolve();await final;
  assert.equal(stage.visitorVisible,true);assert.equal(nodes['.dialogue-box'].hidden,false);
});
