const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('intro preview never calls APIs or storage; characters retain names',()=>{
  const nodes = new Map(); let rendered;
  const context = {
    document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{addEventListener:(_,fn)=>nodes.get(id).click=fn});return nodes.get(id);}},
    DialogueStage:class {render(data){rendered=data;}},
    fetch(){throw Error('API calls forbidden');},
    localStorage:new Proxy({}, {get(){throw Error('Storage access forbidden');}}),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/dialogue-preview.js'),'utf8'),context);
  assert.equal(rendered.speaker,''); assert.equal(rendered.object,'tv');
  for(const [id,name] of [['jimmy','지미'],['karen','캐런'],['bob','밥'],['cathy','캐시']]) {
    nodes.get(id).click(); assert.equal(rendered.speaker,name);
  }
  nodes.get('long').click(); assert.equal(rendered.speaker,'');
  assert.equal(rendered.text.split('\n').length,30);
});
test('start links to the real name form while the intro preview stays separate',()=>{
  const index=fs.readFileSync(path.join(__dirname,'../templates/index.html'),'utf8');
  const intro=fs.readFileSync(path.join(__dirname,'../templates/detail.html'),'utf8');
  const chat=fs.readFileSync(path.join(__dirname,'../templates/chat.html'),'utf8');
  assert.match(index,/url_for\('chat'\) }}" aria-label="시작하기"/);
  assert.doesNotMatch(index,/continue-story|start\.js|이어하기/);
  assert.doesNotMatch(intro,/<form|<script|name-entry/);
  assert.match(intro,/class="dialogue-speaker"><\/span><span class="dialogue-text"><\/span>/);
  assert.match(chat,/id="name-form"/);
  assert.match(chat,/assets\/js\/name-entry\.js/);
});
