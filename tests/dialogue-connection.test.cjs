const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function node() {
  return {
    children: [], listeners: {}, style: {}, hidden: false, disabled: false,
    append(item) { this.children.push(item); },
    replaceChildren(...items) { this.children = items; },
    setAttribute() {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    focus() { this.focused = true; },
    close() { this.hidden = true; },
  };
}

function setup() {
  const nodes = new Map();
  const listeners = {};
  let stage;
  let move;
  const context = vm.createContext({
    document: {
      querySelector: () => node(),
      getElementById: id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
      createElement: node,
    },
    window: {
      addEventListener: (name, callback) => { listeners[name] = callback; },
      location: {reload() { this.reloaded = true; }},
    },
    localStorage: new Proxy({}, {get() { throw Error('persistent storage forbidden'); }}),
    sessionStorage: new Proxy({}, {get() { throw Error('session storage forbidden'); }}),
    DialogueStage: class {render(data) { stage = data; }},
    PostMoveUI: class {render(data) { move = data; }},
    fetch: async () => { throw Error('not expected'); },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/chatbot.js'), 'utf8'), context);
  return {context, nodes, listeners, stage: () => stage, move: () => move,
    transcript: () => vm.runInContext('transcript', context)};
}

function response(sceneId, locationId, characterId, events, affinity = 50) {
  return {
    state_token: `token-${sceneId}-${locationId}`,
    events,
    view: {
      scene_id: sceneId, location_id: locationId, location_name: locationId,
      background: `/assets/images/${locationId}.svg`, affinity, journal: [], ending: null,
      available_characters: characterId ? [{id: characterId, name: characterId, portrait: `/${characterId}.svg`}] : [],
      available_actions: [{id: 'visit_neighbors', label: '이동', kind: 'move'}],
    },
  };
}

test('successful movement clears progress status while failures remain visible', async () => {
  const h = setup();
  h.context.window.startStory(response('arrival', 'player_house', 'jimmy', []), '알렉스');
  h.context.fetch = async () => ({ok: true, json: async () => response('neighbors', 'square', null, [])});
  await vm.runInContext("performAction('visit_neighbors')", h.context);
  assert.equal(h.nodes.get('status-message').textContent, '');
  h.context.fetch = async () => ({ok: false, json: async () => ({error: {message: '다시 시도해 주세요'}})});
  await vm.runInContext("performAction('visit_neighbors')", h.context);
  assert.equal(h.nodes.get('status-message').textContent, '다시 시도해 주세요');
});

test('start uses response in memory and renders the current scene', () => {
  const h = setup();
  h.context.window.startStory(response('arrival', 'player_house', 'jimmy', [
    {speaker_id: 'jimmy', text: '<script>첫 인사</script>', image: '/jimmy-smile.svg'},
  ]), '알렉스');
  assert.equal(h.nodes.get('name-screen').hidden, true);
  assert.equal(h.nodes.get('game-screen').hidden, false);
  assert.equal(h.stage().text, '<script>첫 인사</script>');
  assert.equal(h.nodes.get('chat-log').children[0].children[1].textContent, '<script>첫 인사</script>');
  assert.equal(h.move().affinity, 50);
  assert.equal(h.transcript()[0].scene_id, 'arrival');
  assert.equal(h.transcript()[0].location_id, 'player_house');
});

test('naming continues an already visible Jimmy visit without replaying his entrance',()=>{
  const h=setup();h.context.window.entryVisitReady=true;
  h.context.window.startStory(response('arrival','player_house','jimmy',[]),'예준');
  assert.equal(vm.runInContext('dialogueStage.homeVisitor',h.context),'jimmy');
  assert.equal(h.context.window.entryVisitReady,false);
  assert.equal(h.nodes.get('game-screen').hidden,false);
});

test('first greeting choices hide every visited place, preserve return home, and reset for a new game',()=>{
  const h=setup();
  const actions=['visit_karen','visit_bob','visit_cathy','return_home'].map(id=>({id,kind:'move',label:id}));
  const scene=(location,sceneId='neighbors')=>{const data=response(sceneId,location,null,[]);data.view.available_actions=actions;return data;};
  const labels=()=>h.nodes.get('action-list').children.map(button=>button.textContent);
  h.context.window.startStory(scene('karen_house'),'예준');
  assert.deepEqual(labels(),['visit_bob','visit_cathy','return_home']);
  h.context.applyResponse(scene('butcher_shop'),'scene');
  assert.deepEqual(labels(),['visit_cathy','return_home']);
  h.context.applyResponse(scene('salon'),'scene');assert.deepEqual(labels(),['return_home']);
  h.context.applyResponse(scene('karen_house','karen_dinner'),'scene');
  assert.deepEqual(labels(),actions.map(a=>a.label));
  h.context.window.startStory(scene('square'),'새 이름');
  assert.deepEqual(labels(),actions.map(a=>a.label));
});

test('current scene events and current character chat never mix other scenes or people', () => {
  const h = setup();
  h.context.window.startStory(response('neighbors', 'karen_house', 'karen', [
    {speaker_id: 'karen', text: '캐런 인사', image: null},
  ]), '알렉스');
  vm.runInContext(`saveMessage({speaker:'user',text:'캐런 질문',kind:'chat',character_id:'karen',scene_id:'neighbors',location_id:'karen_house'})`, h.context);
  vm.runInContext(`saveMessage({speaker:'karen',text:'캐런 답변',kind:'chat',character_id:'karen',scene_id:'neighbors',location_id:'karen_house'})`, h.context);
  h.context.applyResponse(response('neighbors', 'butcher_shop', 'bob', [
    {speaker_id: 'bob', text: '밥 인사', image: null},
  ]), 'scene');
  assert.deepEqual(h.nodes.get('chat-log').children.map(item => item.children[1].textContent), ['밥 인사']);
  h.context.applyResponse(response('bob_caught', 'butcher_shop', 'bob', [
    {speaker_id: 'bob', text: '새 장면', image: null},
  ]), 'scene');
  assert.deepEqual(h.nodes.get('chat-log').children.map(item => item.children[1].textContent), ['새 장면']);
  assert.equal(h.transcript().length, 5);
});

test('chat sends the in-memory token and keeps player and reply metadata', async () => {
  const h = setup();
  h.context.window.startStory(response('arrival', 'player_house', 'jimmy', []), '알렉스');
  let request;
  h.context.fetch = async (url, options) => {
    request = {url, payload: JSON.parse(options.body)};
    return {ok: true, json: async () => response('arrival', 'player_house', 'jimmy', [
      {speaker_id: 'jimmy', text: '답변', image: '/jimmy-smile.svg'},
    ])};
  };
  h.nodes.get('user-message').value = '마을은 어때요?';
  await h.nodes.get('chat-form').listeners.submit({preventDefault() {}});
  assert.equal(request.url, '/api/chat');
  assert.equal(request.payload.state_token, 'token-arrival-player_house');
  assert.equal(request.payload.character_id, 'jimmy');
  assert.equal(h.transcript()[0].speaker, 'user');
  assert.equal(h.transcript()[0].character_id, 'jimmy');
  assert.equal(h.transcript()[0].scene_id, 'arrival');
  assert.equal(h.transcript()[0].location_id, 'player_house');
  assert.equal(h.transcript()[1].kind, 'chat');
  assert.deepEqual(h.nodes.get('chat-log').children.map(item => item.children[1].textContent), ['마을은 어때요?', '답변']);
});

test('leaving clears memory and a history restore reloads to the name screen', () => {
  const h = setup();
  h.context.window.startStory(response('arrival', 'player_house', 'jimmy', [
    {speaker_id: 'jimmy', text: '첫 인사', image: null},
  ]), '알렉스');
  h.listeners.pagehide();
  assert.equal(vm.runInContext('stateToken', h.context), null);
  assert.equal(h.transcript().length, 0);
  h.listeners.pageshow({persisted: true});
  assert.equal(h.context.window.location.reloaded, true);
  assert.equal(h.nodes.get('username').value, '');
});
test('failed chat keeps the draft and token so the same message can be retried',async()=>{
  const h=setup();h.context.window.startStory(response('arrival','player_house','jimmy',[]),'알렉스');
  h.nodes.get('user-message').value='다시 물어볼게요';
  h.context.fetch=async()=>({ok:false,json:async()=>({error:{message:'잠시 후 재시도'}})});
  await h.nodes.get('chat-form').listeners.submit({preventDefault(){}});
  assert.equal(h.nodes.get('user-message').value,'다시 물어볼게요');assert.equal(h.transcript().length,0);
  assert.equal(vm.runInContext('stateToken',h.context),'token-arrival-player_house');
  let sent;h.context.fetch=async(_,opts)=>{sent=JSON.parse(opts.body);return {ok:true,json:async()=>response('arrival','player_house','jimmy',[{speaker_id:'jimmy',text:'답변',image:null}])};};
  await h.nodes.get('chat-form').listeners.submit({preventDefault(){}});
  assert.equal(sent.message,'다시 물어볼게요');assert.equal(h.stage().text,'답변');
});
