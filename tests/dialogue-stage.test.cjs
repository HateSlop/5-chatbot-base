const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const nodes = {};
  for (const name of ['background','figure','tv','speaker','text','box']) {
    nodes[`.dialogue-${name}`] = {hidden: true, textContent: '', removeAttribute(key) {delete this[key];}};
  }
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/assets/js/dialogue-stage.js'),'utf8'), context);
  return {nodes, stage: new context.window.DialogueStage({querySelector: s=>nodes[s]})};
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
