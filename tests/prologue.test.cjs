const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(reduced=false) {
  const markup=fs.readFileSync('templates/chat.html','utf8').split('<div class="prologue-copy"')[1].split('</div>')[0];
  const lines=[...markup.matchAll(/<p hidden>(.*?)<\/p>/g)].map(match=>({textContent:match[1],hidden:true}));
  const originalTexts=lines.map(line=>line.textContent);
  const timers=new Map(),events={},documentEvents={},classes=new Set();let id=0,skip,sound;
  const copy={scrollTop:0,scrollHeight:100,querySelectorAll:()=>lines,scrollTo(options){this.scrolled=options;}};
  const root={hidden:true,focus(){this.focused=true;},classList:{add:key=>classes.add(key),remove:key=>classes.delete(key)},
    querySelector:selector=>selector==='.prologue-copy'?copy:{addEventListener:(_,fn)=>skip=fn}};
  const window={locationMusic:{enabled:true},matchMedia:()=>({matches:reduced}),addEventListener:(key,fn)=>events[key]=fn};
  const document={hidden:false,addEventListener:(key,fn)=>documentEvents[key]=fn,getElementById:()=>({addEventListener:(_,fn)=>documentEvents.mute=fn})};
  class Audio {constructor(path){this.path=path;this.paused=true;sound=this;} pause(){this.paused=true;} play(){this.paused=false;return Promise.resolve();}}
  vm.runInNewContext(fs.readFileSync('public/assets/js/prologue.js','utf8'),{window,document,Audio,
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:key=>timers.delete(key)});
  const prologue=new window.Prologue(root);
  return {prologue,root,lines,originalTexts,timers,events,documentEvents,document,window,sound,classes,copy,skip:()=>skip(),
    advance(){const [key,timer]=timers.entries().next().value;timers.delete(key);timer.fn();}};
}
test('all eleven supplied paragraphs type in order without losing text, then the diary leaves',async()=>{
  const h=setup();const ready=h.prologue.play();
  assert.equal(h.lines.length,11);
  assert.equal(h.originalTexts[0],'부모님이 갑작스러운 사고로 돌아가신 지도 벌써 몇 달이 지났다.');
  assert.equal(h.lines.at(-1).textContent,'어디 그런 곳 없을까…?');
  assert.equal(h.root.focused,true);assert.equal(h.lines.filter(line=>!line.hidden).length,1);
  assert.equal(h.lines[0].textContent,'부');h.advance();assert.equal(h.lines[0].textContent,'부모');
  let ticks=0;
  while(!h.classes.has('is-leaving') && ticks++<5000) h.advance();
  assert.ok(ticks<5000);assert.deepEqual(h.lines.map(line=>line.textContent),h.originalTexts);
  assert.ok(h.lines.every(line=>!line.hidden));assert.equal(h.root.hidden,false);assert.equal(h.sound.paused,true);
  h.advance();assert.equal(await ready,true);assert.equal(h.root.hidden,true);assert.equal(h.timers.size,0);
});
test('skip finishes once and leaving cancels the narration without a later reveal',async()=>{
  const h=setup();let ready=h.prologue.play();h.skip();h.skip();assert.equal(h.timers.size,1);
  h.advance();assert.equal(await ready,true);
  ready=h.prologue.play();assert.equal(h.lines.filter(line=>!line.hidden).length,1);
  h.events.pagehide();assert.equal(await ready,false);assert.equal(h.root.hidden,true);assert.equal(h.timers.size,0);
});
test('reduced motion keeps reading order but skips the fade-out wait and smooth scrolling',async()=>{
  const h=setup(true);const ready=h.prologue.play();assert.equal(h.lines[0].textContent,h.originalTexts[0]);assert.equal(h.sound.paused,true);
  h.skip();assert.equal([...h.timers.values()][0].ms,0);h.advance();assert.equal(await ready,true);
});

test('typing sound follows writing, mute and tab visibility; skip and exit stop it',async()=>{
  const h=setup();let ready=h.prologue.play();
  assert.equal(h.sound.path,'/assets/audio/monologue-typing.wav');assert.equal(h.sound.paused,false);
  h.window.locationMusic.enabled=false;h.documentEvents.mute();assert.equal(h.sound.paused,true);
  h.window.locationMusic.enabled=true;h.documentEvents.mute();assert.equal(h.sound.paused,false);
  h.document.hidden=true;h.documentEvents.visibilitychange();assert.equal(h.sound.paused,true);
  const text=h.lines[0].textContent;h.advance();assert.equal(h.lines[0].textContent,text);
  h.document.hidden=false;h.documentEvents.visibilitychange();assert.equal(h.sound.paused,false);
  h.skip();assert.equal(h.sound.paused,true);h.advance();await ready;
  h.sound.play=()=>Promise.reject(Error('blocked'));ready=h.prologue.play();await Promise.resolve();
  h.events.pagehide();assert.equal(await ready,false);assert.equal(h.sound.currentTime,0);
});
