const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("public/assets/js/chatbot.js", "utf8");

function openChat(initialEntry, persisted = false) {
  const storage = new Map(initialEntry ? [["new-village-entry", "1"]] : []);
  const listeners = {};
  const restart = { href: "/detail" };
  const location = { destination: null, replace(url) { this.destination = url; } };
  let starts = 0;
  const element = { addEventListener() {} };
  const context = {
    document: {
      querySelector: () => ({ dataset: { playerName: "알렉스" } }),
      getElementById: (id) => id === "restart-btn" ? restart : element,
    },
    sessionStorage: {
      getItem: (key) => storage.get(key),
      removeItem: (key) => storage.delete(key),
    },
    localStorage: { removeItem() {} },
    window: { addEventListener: (name, callback) => { listeners[name] = callback; } },
    location,
    fetch: async () => { starts++; throw new Error("offline"); },
  };
  vm.runInNewContext(source, context);
  if (persisted) listeners.pageshow({ persisted: true });
  return { storage, location, starts };
}

const first = openChat(true);
assert.equal(first.starts, 1);
assert.equal(first.storage.has("new-village-entry"), false);
assert.equal(first.location.destination, null);
assert.equal(openChat(false).location.destination, "/detail");
assert.equal(openChat(false).starts, 0);
assert.equal(openChat(true, true).location.destination, "/detail");

const detail = fs.readFileSync("templates/detail.html", "utf8");
const chat = fs.readFileSync("templates/chat.html", "utf8");
assert.match(detail, /sessionStorage\.setItem\("new-village-entry", "1"\)/);
assert.match(chat, /id="ending-restart"[^>]+url_for\('detail'\)/);
console.log("새 입장·새로고침·화면 재진입·엔딩 새 시작 확인");
