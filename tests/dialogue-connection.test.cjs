const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function node() { return {dataset:{playerName:'예준'},style:{},children:[],append(x){this.children.push(x);},replaceChildren(){this.children=[];},setAttribute(){},addEventListener(){},focus(){}}; }
test('resume restores names for thoughts and absent characters without interpreting HTML',async()=>{
  for (const [speaker,expected] of [['thought',''],['jimmy','지미']]) {
    const nodes = new Map(); const saved = new Map([
      ['new-village-state-v1','test-token'],
      ['new-village-transcript-v1',JSON.stringify([{speaker,text:'<script>문자</script>',image:null}])],
      ['new-village-player-name-v1','예준 <b>'],
    ]);
    let rendered;
    const context = {
      URL, URLSearchParams,
      document:{querySelector:()=>node(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node},
      window:{location:{search:'',href:'http://localhost/chat'}},
      localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
      DialogueStage:class {render(data){rendered=data;}},
      PostMoveUI:class {render(){}},
      fetch:async()=>({ok:true,json:async()=>({state_token:'test-token',events:[],view:{background:null,location_id:'square',available_characters:[],available_actions:[],journal:[],ending:null}})}),
    };
    vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/assets/js/chatbot.js'),'utf8'),context);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(rendered.speaker,expected);
    assert.equal(rendered.text,'<script>문자</script>');
    assert.equal(nodes.get('chat-log').children[0].children[0].textContent,expected ? `${expected}: ` : '');
  }
});
