const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const nodes = {};
  for (const name of ['background','figure','tv','speaker','text','box']) {
    nodes[`.dialogue-${name}`] = {hidden: true, textContent: '', removeAttribute(key) {delete this[key];}};
  }
  nodes['.move-composer']={hidden:false};
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/assets/js/dialogue-stage.js'),'utf8'), context);
  return {nodes, stage: new context.window.DialogueStage({dataset:{},querySelector: s=>nodes[s]})};
}
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
  assert.equal(pauses[0].ms,500);pauses.shift().resolve();await settle();
  assert.equal(nodes['.dialogue-figure'].src,'/assets/images/jimmy.png');
  assert.equal(nodes['.dialogue-box'].hidden,true);
  assert.equal(nodes['.move-composer'].hidden,true);
  assert.equal(pauses[0].ms,400);pauses.shift().resolve();await stage.ready;
  assert.equal(nodes['.dialogue-box'].hidden,false);
  assert.equal(nodes['.move-composer'].hidden,false);
  stage.render({background:'/assets/images/player_house.svg',image:'/assets/images/jimmy_worried.svg',speaker:'지미',text:'답변'});await stage.ready;
  assert.equal(pauses.length,0);
  assert.equal(nodes['.dialogue-background'].src,'/assets/images/player_house_open.png');
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
