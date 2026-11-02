const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createSession}=require('./helpers/chat-isolated.cjs');
const ai=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js');
(async()=>{
 for(const greeting of ["How's it going?",'hi','How are you doing?','hi how are you?','Hello, how are you','hey how r u?']){
  const session=createSession('greeting-'+greeting);
  let reply=await session.send(greeting,{canonical:ai.directMeaning(greeting,{},engine)});
  assert.match(reply.botMessage,/I'm Sam.*first name/);assert.doesNotMatch(reply.botMessage,/tell me.*goals/i);
  const bubbles=reply.botMessage.split(' / ');assert.equal(bubbles.length,2);assert.match(bubbles[1],/first name/);
  if(engine.socialGreeting(greeting))assert.match(bubbles[0],/doing well, thanks for asking/);
  reply=await session.send('Benjamin');assert.match(reply.botMessage,/Nice to meet you, Benjamin/);assert.match(reply.botMessage,/buy or sell/);
  const client=ai.create({engine,fetch:()=>{throw Error('AI must not be called for buy');}});
  const interpretation=await client.interpret('buy',{intent:null});
  reply=await session.send('buy',interpretation);
  assert.equal(session.audit().internalState.intent,'buying');
  assert.match(reply.botMessage,/out of state|already local/);assert.doesNotMatch(reply.botMessage,/don't.*understand|buy or sell/);
  assert.equal(session.audit().blockedAttempts.length,0);
 }
 const identity=createSession('identity-copy');
 const identityBubbles=(await identity.send('Are you AI?')).botMessage.split(' / ');
 assert.equal(identityBubbles[0],"I'm Sam, the Living in Raleigh team's automated website assistant. I can answer your questions about buying or selling real estate. You can reach Benjamin or Ricardo by calling or texting them directly at 919-737-7896.");
 assert.match(identityBubbles[1],/buy or sell/);
 // Verify the actual receipt helper keeps one receipt beneath the latest
 // user bubble and never changes the visible message or timestamp.
 const source=fs.readFileSync('assets/js/raleigh-chat.js','utf8');
 const helper=source.match(/  function markLatestUserRead\(\) \{[\s\S]*?\n  \}/)[0];
 const receipts=[],contents=[{children:[],appendChild(n){this.children.push(n);receipts.push(n);}}, {children:[],appendChild(n){this.children.push(n);receipts.push(n);}}];
 const scope={log:{querySelectorAll(selector){return selector==='.rchat-read'?receipts.slice():contents;}},document:{createElement(){return {remove(){receipts.splice(receipts.indexOf(this),1);}};}}};
 vm.createContext(scope);vm.runInContext(helper,scope);
 scope.markLatestUserRead();scope.markLatestUserRead();
 assert.equal(receipts.length,1);assert.equal(receipts[0].textContent,'Read');assert.equal(contents[0].children.length,0);
 assert.match(source,/markLatestUserRead\(\);\s*handleText\(value,false/);
 console.log('Greeting → name → buy uses the buyer track without AI; latest-message Read receipt verified. No booking writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
