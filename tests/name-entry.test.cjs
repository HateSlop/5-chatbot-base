const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../public/assets/js/name-entry.js'), 'utf8');

function setup(fetchImpl) {
  const nodes = Object.fromEntries(['name-form', 'username', 'name-submit', 'name-status'].map(id => [id, {
    value: '', textContent: '', disabled: false, attrs: {}, listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(k, fn) { this.listeners[k] = fn; }, focus() { this.focused = true; },
  }]));
  const requests = [];
  const starts = [];
  vm.runInNewContext(source, {
    document: {getElementById: id => nodes[id]},
    window: {startStory: (data, name) => starts.push({data, name})},
    localStorage: new Proxy({}, {get() { throw Error('persistent storage forbidden'); }}),
    sessionStorage: new Proxy({}, {get() { throw Error('session storage forbidden'); }}),
    fetch: async (path, options) => { requests.push({path, payload: JSON.parse(options.body)}); return fetchImpl(); },
  });
  return {nodes, requests, starts,
    submit: value => { nodes.username.value = value; return nodes['name-form'].listeners.submit({preventDefault() {}}); }};
}

const success = () => ({ok: true, json: async () => ({
  state_token: 'fresh', events: [{speaker_id: 'jimmy', text: '첫 인사', image: null}],
  view: {scene_id: 'arrival'},
})});

test('opening and editing do not create a session', () => {
  const h = setup(success);
  h.nodes.username.value = '새 이름';
  h.nodes.username.listeners.input();
  assert.equal(h.requests.length, 0);
});

for (const value of ['', '   ', '가'.repeat(51)]) test(`reject invalid name length ${value.length}`, async () => {
  const h = setup(success);
  await h.submit(value);
  assert.equal(h.requests.length, 0);
  assert.equal(h.nodes.username.attrs['aria-invalid'], 'true');
});

test('trim name and hand the first response to the game in the same document', async () => {
  const h = setup(success);
  await h.submit('  새 이름  ');
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].path, '/api/session');
  assert.equal(h.requests[0].payload.player_name, '새 이름');
  assert.equal(h.starts[0].name, '새 이름');
  assert.equal(h.starts[0].data.events[0].text, '첫 인사');
  assert.equal(h.starts[0].data.state_token, 'fresh');
});

test('50 characters accepted; failure keeps name and allows retry', async () => {
  const accepted = setup(success);
  await accepted.submit('가'.repeat(50));
  assert.equal(accepted.starts.length, 1);
  const failed = setup(() => ({ok: false, json: async () => ({error: {message: '실패'}})}));
  await failed.submit(' 유지할 이름 ');
  assert.equal(failed.starts.length, 0);
  assert.equal(failed.nodes.username.value, ' 유지할 이름 ');
  assert.equal(failed.nodes['name-submit'].disabled, false);
  await failed.submit('재시도');
  assert.equal(failed.requests.length, 2);
});

test('duplicate submit is blocked while the first request is pending', async () => {
  let resolve;
  const h = setup(() => new Promise(r => { resolve = r; }));
  const pending = h.submit('이름');
  await h.submit('이름');
  assert.equal(h.requests.length, 1);
  resolve(success());
  await pending;
});
