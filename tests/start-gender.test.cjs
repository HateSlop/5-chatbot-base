const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('start opens a two-sided gender choice and back returns focus', () => {
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
  node('gender-back').listeners.click();
  assert.equal(node('gender-dialog').open, false);
  assert.equal(node('start-action').focused, true);
  const markup = fs.readFileSync('templates/index.html', 'utf8');
  assert.match(markup, /class="gender-options"/);
  assert.match(markup, /data-gender="male"/);
  assert.match(markup, /data-gender="female"/);
  assert.doesNotMatch(markup, /gender-art[^>]*src=/);
  const css = fs.readFileSync('public/assets/css/start.css', 'utf8');
  assert.match(css, /\.gender-dialog \{[^}]*width: 100vw/);
  assert.match(css, /\.gender-options \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
