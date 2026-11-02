const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../public/assets/js/name-entry.js'), 'utf8');
function setup(fetchImpl) {
  const nodes = Object.fromEntries(['name-form','username','name-submit','name-status'].map(id => [id, {
    value: '', textContent: '', disabled: false, attrs: {}, listeners: {},
    setAttribute(k,v) { this.attrs[k]=v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(k,fn) { this.listeners[k]=fn; }, focus() {},
  }]));
  nodes['name-form'].action = 'http://localhost/chat';
  const saved = new Map([['new-village-state-v1','previous'],['new-village-transcript-v1','previous transcript']]);
  const requests = []; let destination;
  vm.runInNewContext(source, {
    document: { getElementById: id => nodes[id] }, URL,
    localStorage: { getItem:k=>saved.get(k)??null, setItem:(k,v)=>saved.set(k,v), removeItem:k=>saved.delete(k) },
    window: { location: { href:'http://localhost/detail?start=new', assign:url=>destination=url } },
    fetch: async (path,options) => { requests.push(JSON.parse(options.body)); return fetchImpl(); },
  });
  return { nodes, saved, requests, destination:()=>destination,
    submit: value => { nodes.username.value=value; return nodes['name-form'].listeners.submit({preventDefault(){}}); } };
}
const success = () => ({ok:true,json:async()=>({state_token:'fresh',events:[{speaker_id:'jimmy',text:'first greeting',image:null}],view:{scene_id:'arrival'}})});
test('opening and editing preserve the existing save', () => {
  const h=setup(success); h.nodes.username.value='New'; h.nodes.username.listeners.input();
  assert.equal(h.saved.get('new-village-state-v1'),'previous'); assert.equal(h.requests.length,0);
});
for (const value of ['', '   ', '가'.repeat(51)]) test(`reject invalid name length ${value.length}`,async()=>{
  const h=setup(success); await h.submit(value);
  assert.equal(h.requests.length,0); assert.equal(h.nodes.username.attrs['aria-invalid'],'true');
  assert.equal(h.saved.get('new-village-state-v1'),'previous');
});
test('trim name, replace save only on success, retain first events and navigate without creating twice',async()=>{
  const h=setup(success); await h.submit('  새 이름  ');
  assert.equal(h.requests[0].player_name,'새 이름'); assert.equal(h.saved.get('new-village-state-v1'),'fresh');
  assert.equal(JSON.parse(h.saved.get('new-village-transcript-v1'))[0].speaker,'jimmy');
  const url=new URL(h.destination()); assert.equal(url.searchParams.get('username'),'새 이름'); assert.equal(url.searchParams.has('start'),false);
});
test('50 characters accepted',async()=>{const h=setup(success); await h.submit('가'.repeat(50)); assert.ok(h.destination());});
test('server or network failure preserves name and both previous records, allows retry',async()=>{
  for (const fetchImpl of [()=>({ok:false,json:async()=>({error:{message:'실패'}})}),()=>{throw Error('offline');}]) {
    const h=setup(fetchImpl); await h.submit(' 유지할 이름 ');
    assert.equal(h.saved.get('new-village-state-v1'),'previous'); assert.equal(h.saved.get('new-village-transcript-v1'),'previous transcript');
    assert.equal(h.nodes.username.value,' 유지할 이름 '); assert.equal(h.destination(),undefined);
    assert.equal(h.nodes['name-submit'].disabled,false); await h.submit('재시도'); assert.equal(h.requests.length,2);
  }
});
test('duplicate submit is blocked while the first request is pending',async()=>{
  let resolve; const h=setup(()=>new Promise(r=>resolve=r));
  const pending=h.submit('이름'); await h.submit('이름');
  assert.equal(h.requests.length,1); assert.equal(h.nodes['name-submit'].disabled,true);
  resolve(success()); await pending;
});
