const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('START opens the framed gender choice and dismissal returns focus', () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; },
      showModal() { this.open = true; }, close() { this.open = false; this.listeners.close(); },
      focus() { this.focused = true; }, querySelector() { return node('male-option'); }});
    return nodes.get(id);
  };
  vm.runInNewContext(fs.readFileSync('public/assets/js/start-gender.js', 'utf8'), {
    document: {getElementById: node},
    localStorage: new Proxy({}, {get() { throw Error('storage forbidden'); }}),
    sessionStorage: new Proxy({}, {get() { throw Error('storage forbidden'); }}),
  });
  node('start-action').listeners.click();
  assert.equal(node('gender-dialog').open, true);
  assert.equal(node('male-option').focused, true);
  node('gender-dialog').close();
  assert.equal(node('gender-dialog').open, false);
  assert.equal(node('start-action').focused, true);
  const markup = fs.readFileSync('templates/index.html', 'utf8');
  assert.match(markup, /class="gender-options"/);
  assert.match(markup, /data-gender="male"/);
  assert.match(markup, /data-gender="female"/);
  assert.match(markup, /player_male\.png/);
  assert.match(markup, /player_female\.png/);
  assert.match(markup, /id="start-action"[^>]*>START<\/button>/);
  assert.match(markup, /캐릭터를 선택하세요/);
  assert.doesNotMatch(markup, /gender-back/);
  const css = fs.readFileSync('public/assets/css/start.css', 'utf8');
  assert.match(css, /\.gender-dialog \{[^}]*width: min\(720px/);
  assert.match(css, /\.gender-options \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 260px\)\)/);
});
test('assimilated START replay opens character choice without retaining the query', () => {
  const nodes=new Map();
  const get=id=>{
    if (!nodes.has(id)) nodes.set(id,{listeners:{},addEventListener(k,f){this.listeners[k]=f;},click(){this.listeners.click();},showModal(){this.open=true;},focus(){this.focused=true;},querySelector(){return get('male-option');}});
    return nodes.get(id);
  };
  let cleaned=false;
  vm.runInNewContext(fs.readFileSync('public/assets/js/start-gender.js','utf8'),{
    document:{getElementById:get}, URLSearchParams,
    window:{location:{search:'?autostart=1'},history:{replaceState(_a,_b,path){cleaned=path==='/';}}},
  });
  assert.equal(cleaned,true);
  assert.equal(get('gender-dialog').open,true);
  assert.equal(get('male-option').focused,true);
});
