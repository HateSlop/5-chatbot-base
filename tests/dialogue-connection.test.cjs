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
    attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    showModal() { this.open = true; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    focus() { this.focused = true; },
    close() { this.hidden = true; this.open = false; },
  };
}

function setup({missingBasket = false} = {}) {
  const nodes = new Map();
  const basketTools = ['shampoo', 'scissors', 'conditioner', 'comb', 'spray', 'serum', 'brush', 'mirror', 'towel', 'roller'].map(tool =>
    Object.assign(node(), {dataset: {tool}}));
  const listeners = {};
  const timers = new Map();
  let timerId = 0;
  let stage;
  let move;
  let split;
  let clock = 0;
  const context = vm.createContext({
    document: {
      querySelector: () => node(),
      querySelectorAll: selector => !missingBasket && selector === '#cathy-tool-list button' ? basketTools : [],
      getElementById: id => { if (missingBasket && id.startsWith('cathy-')) return null; if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
      createElement: node,
    },
    window: {
      addEventListener: (name, callback) => { listeners[name] = callback; },
      location: {reload() { this.reloaded = true; }, assign(path) { this.assigned = path; }},
    },
    localStorage: new Proxy({}, {get() { throw Error('persistent storage forbidden'); }}),
    sessionStorage: new Proxy({}, {get() { throw Error('session storage forbidden'); }}),
    DialogueStage: class {render(data) { stage = data; }},
    PostMoveUI: class {render(data) { move = data; } setSplit(enabled) { split = enabled; }},
    fetch: async () => { throw Error('not expected'); },
    Date: {now:()=>clock},
    setTimeout: (callback, ms) => { const id = ++timerId; timers.set(id, {callback, ms}); return id; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/chatbot.js'), 'utf8'), context);
  return {context, nodes, listeners, timers, basketTools, stage: () => stage, move: () => move, split: () => split,
    setClock:value=>clock=value,
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
  h.context.window.startStory(response('festival_invite', 'player_house', 'bob', []), '알렉스');
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

test('the left guide receives the server scene and only offers questions when chat is available', () => {
  const h = setup();
  h.context.window.startStory(response('arrival', 'player_house', 'jimmy', []), '알렉스');
  assert.equal(h.move().sceneId, 'arrival');
  assert.equal(h.move().locationId, 'player_house');
  assert.equal(h.move().characterId, 'jimmy');
  assert.equal(h.move().canChat, true);
  h.context.applyResponse(response('basement', 'basement', null, []), 'scene');
  assert.equal(h.move().canChat, false);
  h.context.applyResponse(response('festival', 'square', 'bob', []), 'scene');
  assert.equal(h.move().canChat, false);
  assert.equal(h.split(), true);
  const ending = response('ending', 'square', null, []);
  ending.view.ending = 'assimilation';
  h.context.applyResponse(ending, 'scene');
  assert.equal(h.move().canChat, false);
  assert.equal(h.split(), false);
});

test('festival keeps the sidebar, uses the four scene photos and reveals choices after the stares', async () => {
  const h = setup();
  const meal = response('festival', 'square', 'bob', [{speaker_id:'narrator', text:'축제 식사', image:null}]);
  meal.view.available_actions = [{id:'inspect_food', label:'음식을 살핀다', kind:'inspect'}];
  h.context.window.startStory(meal, '알렉스');
  assert.equal(h.stage().background, '/assets/images/festival_meal.png');
  assert.equal(h.split(), true);
  assert.equal(h.stage().image, null);
  const discovery = response('hair_found', 'square', 'bob', [
    {speaker_id:'thought', text:'음식에서 주황빛 적갈색 머리카락을 발견했다. 음식을 만든 밥은 대머리다.', image:null},
    {speaker_id:'thought', text:'그런 머리색을 가진 지미는 사라졌다. 지하실 화로에서 본 불탄 소지품까지 떠올리자 음식의 정체가 짐작됐다.', image:null},
  ]);
  discovery.view.available_actions = ['escape','stay'].map(id => ({id, label:id, kind:'choice'}));
  h.context.fetch = async () => ({ok:true, json:async () => discovery});
  await vm.runInContext("performAction('inspect_food')", h.context);
  const buttons = () => h.nodes.get('action-list').children;
  assert.equal(h.stage().background, '/assets/images/festival_meat.png');
  assert.equal(h.stage().text, '');
  assert.deepEqual(buttons().map(button => button.textContent), ['다음 장면 ›']);
  h.context.fetch = async () => { throw Error('presentation must not call the server'); };
  await vm.runInContext("performAction('escape')", h.context);
  buttons()[0].listeners.click();
  assert.equal(h.stage().background, '/assets/images/festival_hair.png');
  assert.equal(h.stage().text, discovery.events[0].text);
  h.context.renderView(discovery.view);
  assert.equal(h.stage().background, '/assets/images/festival_hair.png');
  buttons()[0].listeners.click();
  assert.equal(h.stage().background, '/assets/images/festival_stares.png');
  assert.equal(h.split(), true);
  assert.equal(h.stage().text, discovery.events[1].text);
  assert.equal(h.stage().image, null);
  assert.deepEqual(buttons().map(button => button.textContent), ['escape','stay']);
  h.context.applyResponse(response('ending_escape', 'square', null, []), 'scene');
  assert.equal(h.stage().background, '/assets/images/square.svg');
  assert.equal(h.split(), true);
  h.context.window.startStory(meal, '새 이름');
  h.context.applyResponse(discovery, 'scene');
  assert.equal(h.stage().background, '/assets/images/festival_meat.png');
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
  h.context.applyResponse(scene('butcher_shop','bob_caught'),'scene');
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

test('all residents smile unless a chat lowers server affinity, then anger lasts 1.5 seconds', async () => {
  for (const id of ['jimmy', 'karen', 'bob', 'cathy']) {
    const h = setup();
    h.context.window.startStory(response('neighbors', 'salon', id, []), '알렉스');
    assert.equal(h.stage().image, `/assets/images/${id}_smile.png`);
    h.context.applyResponse(response('neighbors', 'salon', id,
      [{speaker_id:id, text:'중립 답변', image:`/assets/images/${id}_worried.svg`}]), 'chat', id);
    assert.equal(h.stage().image, `/assets/images/${id}_smile.png`);
    h.context.applyResponse(response('neighbors', 'salon', id,
      [{speaker_id:id, text:'불쾌한 답변', image:null}], 48), 'chat', id);
    h.context.renderView(vm.runInContext('currentView', h.context));
    await Promise.resolve();
    assert.equal(h.stage().image, `/assets/images/${id}_angry.png`);
    assert.equal(h.timers.size, 1);
    const timer = [...h.timers.values()][0];
    assert.equal(timer.ms, 1500);
    timer.callback();
    assert.equal(h.stage().image, `/assets/images/${id}_smile.png`);
    h.context.applyResponse(response('neighbors', 'salon', id, [], 55), 'chat', id);
    assert.equal(h.stage().image, `/assets/images/${id}_smile.png`);
  }
});

test('angry reaction waits for the displayed answer and is cancelled on movement and exit', async () => {
  const h = setup();
  h.context.window.startStory(response('neighbors', 'salon', 'cathy', []), '알렉스');
  let ready;
  vm.runInContext('dialogueStage.ready = pendingReady', Object.assign(h.context, {
    pendingReady: new Promise(resolve => { ready = resolve; }),
  }));
  h.context.applyResponse(response('neighbors', 'salon', 'cathy', [], 48), 'chat', 'cathy');
  await Promise.resolve();
  assert.equal(h.timers.size, 0);
  ready(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.timers.size, 1);
  h.context.applyResponse(response('neighbors', 'butcher_shop', 'bob', [], 48), 'scene');
  assert.equal(h.timers.size, 0);
  assert.equal(h.stage().image, '/assets/images/bob_smile.png');
  h.context.applyResponse(response('neighbors', 'butcher_shop', 'bob', [], 46), 'chat', 'bob');
  await Promise.resolve();
  h.listeners.pagehide();
  assert.equal(h.timers.size, 0);
});

test('Karen leaves after her greeting, then the door reveals the existing room action', async () => {
  const h = setup();
  const dinner = response('karen_dinner','karen_house',null, [{speaker_id:'karen',text:'편히 둘러보세요.',image:'/assets/images/karen_smile.png'}]);
  dinner.view.available_actions = [{id:'inspect_room',label:'수상한 방을 살핀다',kind:'inspect'}];
  h.context.window.startStory(dinner,'테스트');
  assert.equal(h.nodes.get('user-message').disabled,true);
  assert.equal(h.nodes.get('send-btn').disabled,true);
  assert.equal(h.stage().text,'편히 둘러보세요.');
  assert.equal(h.stage().image,'/assets/images/karen_smile.png');
  assert.equal(h.nodes.get('action-list').children.length,0);
  await Promise.resolve();
  const timer = [...h.timers.values()].find(t => t.ms === 4500);
  await timer.callback();
  assert.equal(h.stage().image,null);
  assert.equal(h.stage().text,'');
  assert.equal(h.nodes.get('user-message').disabled,true);
  const door = h.nodes.get('dialogue-stage').children[0];
  assert.equal(door.hidden,false);
  door.listeners.click();
  assert.equal(h.stage().text,'이 방은 뭘까?');
  assert.equal(h.nodes.get('action-list').children[0].textContent,'방에 들어가본다');
  let action;
  h.context.fetch = async (_, options) => {
    action = JSON.parse(options.body).action_id;
    return {ok:true,json:async()=>response('photo_found','karen_house',null,[])};
  };
  h.nodes.get('action-list').children[0].listeners.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(action,'inspect_room');
  assert.equal(door.hidden,true);
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

test('waiting and failed replies keep the last expression until a successful reply changes it', async () => {
  const h = setup();
  h.context.window.startStory(response('arrival', 'player_house', 'jimmy', [
    {speaker_id: 'jimmy', text: '무서워.', image: '/jimmy-worried.svg'},
  ]), '알렉스');
  let finish;
  h.context.fetch = () => new Promise(resolve => { finish = resolve; });
  h.nodes.get('user-message').value = '무슨 일이에요?';
  const waiting = h.nodes.get('chat-form').listeners.submit({preventDefault() {}});
  assert.equal(h.stage().text, '무서워.');
  assert.equal(h.stage().image, '/jimmy-worried.svg');
  assert.equal(h.nodes.get('character-portrait').src, '/jimmy-worried.svg');
  finish({ok: true, json: async () => response('arrival', 'player_house', 'jimmy', [
    {speaker_id: 'jimmy', text: '괜찮아졌어.', image: '/jimmy-smile.svg'},
  ])});
  await waiting;
  assert.equal(h.stage().text, '괜찮아졌어.');
  assert.equal(h.stage().image, '/jimmy-smile.svg');
  assert.equal(h.nodes.get('character-portrait').src, '/jimmy-smile.svg');

  h.nodes.get('user-message').value = '다시 말해 줘';
  const retry = h.nodes.get('chat-form').listeners.submit({preventDefault() {}});
  assert.equal(h.stage().text, '괜찮아졌어.');
  assert.equal(h.stage().image, '/jimmy-smile.svg');
  finish({ok: false, json: async () => ({error: {message: '잠시 후 재시도'}})});
  await retry;
  assert.equal(h.stage().text, '괜찮아졌어.');
  assert.equal(h.stage().image, '/jimmy-smile.svg');
  assert.equal(h.nodes.get('character-portrait').src, '/jimmy-smile.svg');
  assert.equal(h.nodes.get('user-message').value, '다시 말해 줘');
});

test('a new scene or character cannot inherit the previous expression', () => {
  const h = setup();
  h.context.window.startStory(response('neighbors', 'karen_house', 'karen', [
    {speaker_id: 'karen', text: '반가워요.', image: '/karen-smile.svg'},
  ]), '알렉스');
  assert.equal(h.stage().image, '/karen-smile.svg');
  h.context.applyResponse(response('karen_dinner', 'karen_house', 'karen', []), 'scene');
  assert.equal(h.stage().image, '/assets/images/karen_smile.png');
  assert.equal(h.nodes.get('character-portrait').src, '/karen.svg');
  h.context.applyResponse(response('karen_dinner', 'karen_house', 'bob', []), 'scene');
  assert.equal(h.stage().image, '/bob.svg');
  assert.equal(h.nodes.get('character-portrait').src, '/bob.svg');
  h.context.applyResponse(response('ending', 'square', null, [
    {speaker_id: 'narrator', text: '끝', image: '/ending.svg'},
  ]), 'scene');
  assert.equal(h.stage().image, '/ending.svg');
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


test('open butcher doorway reveals thought before submitting the existing basement action', async () => {
  const h = setup();
  const data = response('empty_butcher', 'butcher_shop', null, [{speaker_id:'jimmy',text:'작별',image:null}]);
  data.view.available_actions = [{id:'inspect_basement',label:'지하실을 살핀다',kind:'inspect'}];
  h.context.window.startStory(data, '테스트');
  assert.equal(h.stage().background, '/assets/images/butcher_shop_open.png');
  assert.equal(h.stage().text, '');
  assert.equal(h.nodes.get('action-list').children.length, 0);
  const door = h.nodes.get('dialogue-stage').children[0];
  assert.equal(door.hidden, false);
  door.listeners.click();
  assert.equal(h.stage().text, '어? 왜 문이 열려있지?');
  assert.equal(h.nodes.get('action-list').children[0].textContent, '지하실에 내려가본다');
  let submitted;
  h.context.fetch = async (_, options) => {
    submitted = JSON.parse(options.body).action_id;
    return {ok:true,json:async()=>response('basement','basement',null,[])};
  };
  h.nodes.get('action-list').children[0].listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(submitted, 'inspect_basement');
  assert.equal(door.hidden, true);
});

test('frightened Jimmy, the empty shop and caught Bob all keep the incident shop background',()=>{
  const h=setup();
  for (const [scene,character] of [['butcher_search','jimmy'],['empty_butcher',null],['bob_caught','bob']]) {
    const data=response(scene,'butcher_shop',character,[{speaker_id:character||'thought',text:'현재 사건',image:character?`/assets/images/${character}_worried.svg`:null}]);
    h.context.window.startStory(data,'테스트');
    assert.equal(h.stage().background,'/assets/images/butcher_shop_open.png');
  }
  h.context.window.startStory(response('neighbors','butcher_shop','bob',[]),'다시 시작');
  assert.equal(h.stage().background,'/assets/images/butcher_shop.svg');
});

test('basement brazier click alone requests its clue and then reveals the exit', async () => {
  const h = setup();
  const basement = response('basement', 'basement', null, []);
  basement.view.available_actions = [{id:'inspect_brazier', label:'화로를 조사한다', kind:'inspect'}];
  h.context.window.startStory(basement, '테스트');
  const hotspot = h.nodes.get('dialogue-stage').children.find(item => item.className === 'door-hotspot brazier-hotspot');
  assert.equal(h.stage().background, '/assets/images/basement.svg');
  assert.equal(hotspot.hidden, false);
  assert.equal(hotspot.attrs['aria-label'], '지하실 화로 조사하기');
  assert.equal(h.nodes.get('action-list').children.length, 0);
  h.context.renderView(basement.view);
  assert.equal(hotspot.hidden, false);
  let sent;
  h.context.fetch = async (_, options) => {
    sent = JSON.parse(options.body).action_id;
    return {ok:false, json:async()=>({error:{message:'잠시 후 다시 시도해 주세요.'}})};
  };
  await hotspot.listeners.click();
  assert.equal(sent, 'inspect_brazier');
  assert.equal(hotspot.hidden, false);
  assert.equal(h.nodes.get('action-list').children.length, 0);
  h.context.fetch = async () => {
    const inspected = response('basement', 'basement', null, [{speaker_id:'thought', text:'불탄 생활 소품', image:null}]);
    inspected.view.available_actions = [{id:'go_upstairs', label:'지하실에서 나온다', kind:'move'}];
    return {ok:true, json:async()=>inspected};
  };
  await hotspot.listeners.click();
  assert.equal(hotspot.hidden, true);
  assert.equal(h.stage().text, '불탄 생활 소품');
  assert.equal(h.nodes.get('action-list').children[0].textContent, '지하실에서 나온다');
  h.context.renderView(vm.runInContext('currentView', h.context));
  assert.equal(hotspot.hidden, true);
  assert.equal(h.nodes.get('action-list').children.length, 1);
});

test('each first greeting requires two successful replies and resets on a new game', async () => {
  const h = setup();
  const data = response('neighbors','karen_house','karen',[]);
  h.context.window.startStory(data,'테스트');
  assert.equal(h.nodes.get('action-list').children.length,0);
  assert.equal(h.move().actions.length,0);
  h.context.applyResponse(data,'chat','karen');
  assert.equal(h.nodes.get('action-list').children.length,0);
  h.context.applyResponse(data,'chat','karen');
  assert.equal(h.nodes.get('action-list').children.length,1);
  assert.equal(h.move().actions.length,1);
  h.context.applyResponse(response('neighbors','butcher_shop','bob',[]),'scene');
  assert.equal(h.nodes.get('action-list').children.length,0);
  h.context.window.startStory(data,'다시');
  assert.equal(h.nodes.get('action-list').children.length,0);
});

test('photo back succeeds before closing recognizes Jimmy and shows Karen once', async () => {
  const h=setup();
  const data=response('photo_found','karen_house',null,[]);
  data.view.photo_back_date=null;
  data.view.available_actions=[{id:'inspect_photo_back',label:'액자 뒷면을 확인한다',kind:'inspect'}, {id:'recognize_photo',label:'사진을 알아본다',kind:'inspect'}];
  h.context.window.startStory(data,'테스트');
  assert.equal(h.stage().background,'/assets/images/karen_secret_room_angle2.png');
  assert.equal(h.stage().text,'저기 뭔가 익숙한 얼굴이..?');
  assert.equal(h.stage().image,null);
  assert.equal(h.move().actions.length,0);
  assert.equal(h.nodes.get('action-list').children.length,0);
  const hotspot=h.nodes.get('dialogue-stage').children[1];
  const dialog=h.nodes.get('photo-dialog'), flip=h.nodes.get('photo-flip');
  assert.equal(hotspot.hidden,false);
  hotspot.listeners.click();
  assert.equal(dialog.open,true);
  h.nodes.get('photo-close').listeners.click();
  assert.equal(dialog.open,false);
  assert.equal(h.stage().text,'지미??????');
  hotspot.listeners.click();
  assert.equal(h.nodes.get('affinity-value').textContent,'50 / 100');
  const requested=[];
  h.context.fetch=async (_,options)=>{
    const action=JSON.parse(options.body).action_id;
    requested.push(action);
    if (action === 'inspect_photo_back') {
      const back=response('photo_found','karen_house',null,[],50);
      back.view.photo_back_date='11월 8일';
      back.view.journal=['액자 뒷면에서 날짜를 보았다.'];
      back.view.available_actions=[{id:'recognize_photo',label:'사진을 알아본다',kind:'inspect'}];
      return {ok:true,json:async()=>back};
    }
    const found=response('photo_found','karen_house',null,[{speaker_id:'karen',text:'거기서 뭘 보고 계신 거죠?',image:'/assets/images/karen_angry.png'}],45);
    found.view.photo_back_date='11월 8일';
    found.view.available_actions=[{id:'return_home',label:'집으로 돌아간다',kind:'move'}];
    return {ok:true,json:async()=>found};
  };
  await flip.listeners.click();
  assert.deepEqual(requested,['inspect_photo_back']);
  assert.equal(flip.attrs['data-back'],'true');
  assert.equal(h.nodes.get('photo-back-date').textContent,'11월 8일');
  await h.nodes.get('photo-close').listeners.click();
  assert.deepEqual(requested,['inspect_photo_back','recognize_photo']);
  assert.equal(h.stage().image,'/assets/images/karen_angry.png');
  assert.equal(h.stage().text,'거기서 뭘 보고 계신 거죠?');
  assert.equal(h.nodes.get('affinity-value').textContent,'45 / 100');
  assert.equal(h.nodes.get('action-list').children[0].textContent,'집으로 돌아간다');
  await h.nodes.get('photo-close').listeners.click();
  assert.equal(requested.length,2);
  h.context.window.startStory(data,'다시');
  assert.equal(h.stage().background,'/assets/images/karen_secret_room_angle2.png');
  assert.equal(h.nodes.get('photo-back-date').textContent,'');
});

test('photo back failure stays on front, retries, and Escape follows the same close rule', async () => {
  const h=setup();
  const data=response('photo_found','karen_house',null,[]);
  data.view.photo_back_date=null;
  data.view.available_actions=[{id:'inspect_photo_back',label:'액자 뒷면을 확인한다',kind:'inspect'}, {id:'recognize_photo',label:'사진을 알아본다',kind:'inspect'}];
  h.context.window.startStory(data,'테스트');
  const hotspot=h.nodes.get('dialogue-stage').children[1];
  const dialog=h.nodes.get('photo-dialog'), flip=h.nodes.get('photo-flip');
  assert.equal(hotspot.hidden,false);
  hotspot.listeners.click();
  let calls=0;
  h.context.fetch=async (_,options)=>{
    calls++;
    assert.equal(JSON.parse(options.body).action_id,'inspect_photo_back');
    return {ok:false,json:async()=>({error:{message:'다시 시도해 주세요'}})};
  };
  await flip.listeners.click();
  assert.equal(flip.attrs['data-back'],'false');
  assert.equal(h.nodes.get('photo-back-date').textContent,'');
  assert.equal(h.nodes.get('photo-hint').textContent,'다시 시도해 주세요');
  const cancel={preventDefault() { this.prevented=true; }};
  await dialog.listeners.cancel(cancel);
  assert.equal(cancel.prevented,true);
  assert.equal(dialog.open,false);
  assert.equal(calls,1);
  hotspot.listeners.click();
  assert.equal(flip.attrs['data-back'],'false');
  h.context.fetch=async (_,options)=>{
    calls++;
    const action=JSON.parse(options.body).action_id;
    if (action === 'inspect_photo_back') {
      const back=response('photo_found','karen_house',null,[]);
      back.view.photo_back_date='11월 8일';
      back.view.available_actions=[{id:'recognize_photo',label:'사진을 알아본다',kind:'inspect'}];
      return {ok:true,json:async()=>back};
    }
    const found=response('photo_found','karen_house',null,[{speaker_id:'karen',text:'방에서 나가 주세요.',image:null}],45);
    found.view.photo_back_date='11월 8일';
    found.view.available_actions=[{id:'return_home',label:'집으로 돌아간다',kind:'move'}];
    return {ok:true,json:async()=>found};
  };
  await flip.listeners.click();
  assert.equal(flip.attrs['data-back'],'true');
  await dialog.listeners.cancel({preventDefault(){}});
  assert.equal(calls,3);
  assert.equal(h.nodes.get('affinity-value').textContent,'45 / 100');
  h.context.window.startStory(response('arrival','player_house','jimmy',[]),'다시');
  assert.equal(dialog.open,false);
  assert.equal(hotspot.hidden,true);
});

test('both festival endings expose a title return and a new play drops old state', () => {
  const html=fs.readFileSync(path.join(__dirname,'../templates/chat.html'),'utf8');
  assert.match(html, /<button id="ending-restart"[^>]*>첫 화면으로 돌아가기<\/button>/);
  for (const ending of ['escape','assimilation']) {
    const h=setup();
    const old=response('hair_found','square','bob',[]);
    old.view.journal=['이전 단서'];
    h.context.window.startStory(old,'옛 이름');
    const result=response(`ending_${ending}`,'square',null,[{speaker_id:'narrator',text:'결말',image:null}]);
    result.view.ending=ending;
    result.view.journal=['이전 단서'];
    h.context.applyResponse(result,'scene');
    assert.equal(h.nodes.get('ending-restart').hidden,false);
    h.nodes.get('ending-restart').listeners.click();
    assert.equal(h.context.window.location.assigned,'/');
    h.context.window.startStory(response('arrival','player_house','jimmy',[]),'새 이름');
    assert.equal(h.transcript().length,0);
    assert.equal(h.nodes.get('journal-list').children.length,0);
    assert.equal(vm.runInContext('stateToken',h.context),'token-arrival-player_house');
    assert.equal(h.nodes.get('ending-restart').hidden,true);
  }
  const death=setup();
  death.context.window.startStory(response('arrival','player_house','jimmy',[]),'이름');
  const result=response('ending_death','square',null,[]);
  result.view.ending='death';
  death.context.applyResponse(result,'scene');
  assert.equal(death.nodes.get('ending-restart').hidden,true);
  const elements=new Map();
  const deathWindow={location:{reload(){this.reloaded=true;}},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/js/scene-effects.js'),'utf8'), {
    window:deathWindow, document:{getElementById(id){if(!elements.has(id)) elements.set(id,node()); return elements.get(id);}},
  });
  elements.get('death-restart').listeners.click();
  assert.equal(deathWindow.location.reloaded,true);
});

test('photo scene has no next button while festival discovery keeps its next button', () => {
  const h=setup();
  const photo=response('photo_found','karen_house',null,[]);
  photo.view.available_actions=[{id:'inspect_photo_back',label:'액자 뒷면을 확인한다',kind:'inspect'}, {id:'recognize_photo',label:'사진을 알아본다',kind:'inspect'}];
  h.context.window.startStory(photo,'이름');
  assert.equal(h.nodes.get('action-list').children.length,0);
  h.context.applyResponse(response('hair_found','square','bob',[]),'scene');
  assert.equal(h.nodes.get('action-list').children[0].textContent,'다음 장면 ›');
});

test('Cathy leaves sooner, then the request counts 3-2-1 over two seconds with a memory hint', async () => {
  const h = setup();
  const request = '바구니에서 샴푸, 가위, 빗 좀 가져다줄래요?';
  const task = response('cathy_help', 'salon', null, [
    {speaker_id:'cathy', text:'지금 너무 바쁘니까 바구니에서 물건 좀 꺼내와줄래요?', image:'/cathy.svg'},
    {speaker_id:'cathy', text:request, image:'/cathy.svg'},
  ]);
  task.view.available_actions = h.basketTools.map(button => button.dataset.tool)
    .map(tool => ({id:`choose_${tool}`, label:tool, kind:'choice'}))
    .concat({id:'help_cathy', label:'캐시에게 전달한다', kind:'choice'});
  h.context.window.startStory(task, '테스트');
  const hotspot = h.nodes.get('dialogue-stage').children.find(item => item.className === 'cathy-basket-hotspot');
  assert.equal(h.stage().dialogue, true);
  assert.equal(h.stage().image, '/assets/images/cathy_smile.png');
  assert.match(h.stage().text, /지금 너무 바쁘니까/);
  assert.equal(hotspot.hidden, true);
  await Promise.resolve();
  const greeting = [...h.timers.values()].find(item => item.ms === 1400);
  assert.ok(greeting);
  await greeting.callback();
  assert.equal(h.stage().dialogue, false);
  assert.equal(h.stage().image, null);
  assert.equal(hotspot.hidden, false);
  assert.equal(h.split(), false);
  assert.equal(hotspot.hidden, false);
  assert.equal(hotspot.textContent, '');
  assert.equal(hotspot.attrs['aria-label'], '미용실 바구니 열기');
  assert.equal(h.nodes.get('action-list').children.length, 0);
  assert.equal(h.move().actions.length, 0);
  assert.equal([...h.timers.values()].some(item => Math.abs(item.ms - 2000 / 3) < .01), false);
  hotspot.listeners.click();
  assert.equal(h.nodes.get('cathy-basket-dialog').open, true);
  assert.equal(h.nodes.get('cathy-basket-request').textContent, request);
  assert.equal(h.nodes.get('cathy-tool-list').hidden, true);
  await Promise.resolve();
  const counter=h.nodes.get('cathy-basket-countdown');
  assert.equal(counter.textContent,'3');assert.equal(counter.hidden,false);
  assert.equal(h.nodes.get('cathy-basket-hint').hidden,false);
  assert.match(h.nodes.get('cathy-basket-hint').textContent,/캐시가 말한 도구를 기억하고 찾아보세요/);
  for (const [remaining,elapsed,delay] of [['2',730,2000/3],['1',4000/3,4000/3-730]]) {
    const [id,timer]=[...h.timers.entries()].find(([,item])=>Math.abs(item.ms-delay)<.01);
    h.setClock(elapsed);
    h.timers.delete(id);timer.callback();
    assert.equal(counter.textContent,remaining);
    assert.equal(h.nodes.get('cathy-basket-request').hidden,false);
    assert.equal(h.nodes.get('cathy-tool-list').hidden,true);
  }
  const [,timer]=[...h.timers.entries()].find(([,item])=>Math.abs(item.ms-2000/3)<.01);h.setClock(2000);timer.callback();
  assert.equal(counter.hidden,true);
  assert.equal(h.nodes.get('cathy-basket-request').hidden, true);
  assert.equal(h.nodes.get('cathy-tool-list').hidden, false);
  const sent = [];
  h.context.fetch = async (_url, options) => {
    const action = JSON.parse(options.body).action_id;
    sent.push(action);
    if (action === 'help_cathy') {
      const result = response('cathy_result', 'salon', null, [{speaker_id:'cathy', text:'정확해요!', image:'/cathy.svg'}], 55);
      result.view.available_actions = [{id:'return_home', label:'집으로 돌아간다', kind:'move'}];
      return {ok:true, json:async () => result};
    }
    return {ok:true, json:async () => ({...task, events:[]})};
  };
  for (const button of [h.basketTools[0], h.basketTools[1], h.basketTools[3]]) await button.listeners.click();
  assert.equal(h.basketTools[0].attrs['aria-pressed'], 'true');
  await h.nodes.get('cathy-deliver').listeners.click();
  assert.deepEqual(sent, ['choose_shampoo', 'choose_scissors', 'choose_comb', 'help_cathy']);
  assert.equal(h.nodes.get('cathy-basket-dialog').open, false);
  assert.equal(h.stage().text, '정확해요!');
});

test('leaving or restarting cannot reveal an old Cathy basket greeting', async () => {
  const h=setup();
  const task=response('cathy_help','salon',null,[{speaker_id:'cathy',text:'샴푸, 가위, 빗',image:null}]);
  h.context.window.startStory(task,'테스트');
  await Promise.resolve();
  const greeting=[...h.timers.values()].find(item=>item.ms===1400);
  h.context.window.startStory(response('arrival','player_house','jimmy',[]),'새 이름');
  await greeting.callback();
  assert.equal(h.stage().sceneId,'arrival');
  assert.equal(h.nodes.get('dialogue-stage').children.find(item=>item.className==='cathy-basket-hotspot').hidden,true);
});

test('name entry still initializes when an older chat page lacks basket markup', async () => {
  const h = setup({missingBasket:true});
  assert.equal(typeof h.context.window.startStory, 'function');
  h.context.window.startStory(response('arrival', 'player_house', 'jimmy', []), '테스트');
  assert.equal(h.nodes.get('game-screen').hidden, false);
  h.context.window.startStory(response('festival_invite', 'player_house', 'bob', []), '테스트');
  h.context.fetch = async () => ({ok:true, json:async () => response('neighbors', 'square', null, [])});
  await vm.runInContext("performAction('visit_neighbors')", h.context);
  assert.equal(h.nodes.get('status-message').textContent, '');
});
test('Karen departure countdown waits until the character is selected', async () => {
  const h=setup();let select;
  h.context.pendingSelection=new Promise(resolve=>{select=resolve;});
  vm.runInContext('dialogueStage.opened = pendingSelection',h.context);
  h.context.window.startStory(response('karen_dinner','karen_house','karen',[{speaker_id:'karen',text:'편히 둘러보세요.',image:null}]),'테스트');
  await Promise.resolve();
  assert.equal([...h.timers.values()].some(t=>t.ms===4500),false);
  select(true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal([...h.timers.values()].some(t=>t.ms===4500),true);
});

test('urgent Karen bell uses the server summons action, not a client affinity check',()=>{
  const h=setup();const data=response('checkpoint','player_house','karen',[],90);
  data.view.available_actions=[{id:'go_butcher',kind:'move',label:'정육점으로 간다'}];
  h.context.window.startStory(data,'테스트');assert.equal(h.stage().doorbellCount,3);
  data.view.affinity=20;data.view.available_actions=[{id:'accept_job',kind:'choice',label:'수락'}];
  h.context.renderView(data.view);assert.equal(h.stage().doorbellCount,1);
});

test('the salon return uncovers its new background before the remaining arrival animation finishes',async()=>{
  const h=setup();let finishArrival;
  h.context.finishSteps=[];
  h.context.backgroundDone=Promise.resolve(true);
  h.context.arrivalDone=new Promise(resolve=>finishArrival=resolve);
  h.context.window.sceneEffects={ending(){},transition:async show=>{await show();h.context.finishSteps.push('visible');}};
  h.context.window.startStory(response('cathy_result','salon',null,[]),'테스트');
  vm.runInContext('dialogueStage.backgroundReady=backgroundDone; dialogueStage.ready=arrivalDone',h.context);
  h.context.fetch=async()=>({ok:true,json:async()=>response('jimmy_butcher','player_house','jimmy',[])});
  const returning=vm.runInContext("request('/api/action', {action_id:'return_home'})",h.context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(h.context.finishSteps,['visible']);
  let complete=false;returning.then(()=>complete=true);await Promise.resolve();assert.equal(complete,false);
  finishArrival();await returning;assert.equal(complete,true);
});
