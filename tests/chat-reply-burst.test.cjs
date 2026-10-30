const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('assets/js/raleigh-chat.js','utf8');const start=src.indexOf('  function message('),end=src.indexOf('\n  function appendReplyContent',start);
const queued=[];const context={replyBurst:[],queueBotMessage:(text,options,item)=>queued.push(item),renderMessage:()=>{},redact:x=>x,persist:()=>{},scrollToLatest:()=>{},panel:{hidden:false}};
vm.createContext(context);vm.runInContext(src.slice(start,end),context);
for(let i=1;i<=6;i++)context.message('Part '+i,false,i===4?{link:{href:'/learning-center/',label:'Guides'}}:{});
assert.equal(queued.length,3);assert.equal(context.replyBurst.length,3);assert.equal(queued[2].text,'Part 3\n\nPart 4\n\nPart 5\n\nPart 6');assert.equal(queued[2].options.links[0].href,'/learning-center/');
// A later async response updates the third bubble rather than creating a fourth.
const nodes=[],time={tag:'time'};const bubble={querySelector:()=>time,replaceChildren:()=>nodes.splice(0),appendChild:n=>nodes.push(n)};
context.appendReplyContent=(node,text,options)=>nodes.push(text,...options.links);queued[2].bubble=bubble;queued[2].historyEntry={text:queued[2].text};context.message('Late calendar result',false);
assert.equal(queued.length,3);assert.match(queued[2].historyEntry.text,/Late calendar result/);assert(nodes.includes(time));assert(nodes.some(n=>n.href==='/learning-center/'));
console.log('Three-message limit preserves overflow text, links, late async results and saved history.');
