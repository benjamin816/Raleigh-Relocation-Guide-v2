const assert=require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
const api=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js');
const phase=s=>JSON.stringify({intent:s.intent,question:s.profile.currentQuestionKey,booking:s.booking?.step,name:s.profile.awaitingFirstName});
(async()=>{
 const seeds=[[],['buy'],['buy','Alex','Texas'],['Book a phone call'],['Book a phone call','first']];
 const browsing=createSession('reported-no-then-identity');await browsing.send('no');
 const browsingBefore=browsing.audit().internalState;
 assert.match((await browsing.send('are you an AI?')).botMessage,/automated website assistant/);
 assert.equal(browsing.audit().internalState.profile.awaitingVisitReason,browsingBefore.profile.awaitingVisitReason);
 assert.equal(browsing.audit().serviceCalls.length,0);
 for(let i=0;i<seeds.length;i++){
  const s=createSession('identity-stage-'+i);for(const text of seeds[i])await s.send(text);
  const before=s.audit().internalState;
  for(const text of ['Are you an AI?','Are you a robot?','r u a human']){
   const reply=await s.send(text);
   assert.match(reply.botMessage,/automated website assistant/);assert.equal(phase(s.audit().internalState),phase(before));
   assert.doesNotMatch(reply.botMessage,/Tell me.*goals|Nice to meet you, Are|time.*unavailable/i);
  }
  assert.equal(s.audit().serviceCalls.some(c=>c.method==='book'),false);
 }
 const semantic=createSession('semantic');for(const text of ['buy','Alex','Texas'])await semantic.send(text);
 const before=semantic.audit().internalState;
 const reply=await semantic.send('what portion would have to be my own money',{canonical:'What portion would have to be my own money?',kind:'question',topic:'faq_1'});
 assert.match(reply.botMessage,/lender/);assert.equal(phase(semantic.audit().internalState),phase(before));
 const unknown=await semantic.send('and the exact rates by next year',{canonical:'What will exact mortgage rates be next year?',kind:'question',topic:'none'});
 assert.match(unknown.botMessage,/reliable answer/);assert.equal(phase(semantic.audit().internalState),phase(before));
 const fresh=createSession('first-question');const answer=await fresh.send('How much down payment do I need?');
 assert.match(answer.botMessage,/lender/);assert.doesNotMatch(answer.botMessage,/first name|Tell me.*goals/);
 assert.equal(fresh.audit().internalState.intent,null);
 // A person's contact value stays out of inference. A question interrupting
 // that field can be interpreted, answered, and returned to the same field.
 assert.equal(api.eligible('Alex',{awaitingFirstName:true},engine),false);
 assert.equal(api.eligible('Are you an AI?',{awaitingFirstName:true},engine),true);
 assert.equal(api.eligible('person@example.com',{booking:'email'},engine),false);
 assert.equal(api.eligible('What do you do with my details?',{booking:'email'},engine),true);
 const mismatch=api.create({engine,endpoint:'https://test.invalid',knowledgeVersion:'new',fetch:async()=>({ok:true,json:async()=>({ok:true,version:'old',interpretation:{kind:'question',certain:true,topic:'faq_1',canonical:'A question?'}})})});
 assert.equal((await mismatch.interpret('How much down payment?',{})).mode,'fallback');
 for(const frame of [{kind:'human',certain:true,canonical:'Can I speak with a person?'},{kind:'answer',certain:true,canonical:'I want a lower price.'}]){
  const guarded=api.create({engine,endpoint:'https://test.invalid',fetch:async()=>({ok:true,json:async()=>({ok:true,interpretation:frame})})});
  const meaning=await guarded.interpret('Who gets my details?',{awaitingFirstName:true});
  assert.equal(meaning.kind,'question');assert.equal(meaning.canonical,'Who gets my details?');
  const s=createSession('misclassified-question');await s.send('buy');const before=s.audit().internalState;
  await s.send('Who gets my details?',meaning);
  assert.equal(phase(s.audit().internalState),phase(before));assert.equal(s.audit().serviceCalls.length,0);
 }
 console.log('Identity at five phases, semantic FAQ selection, unknown-question honesty, pending-step retention, private-field bypass and playbook version matching passed. No writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
