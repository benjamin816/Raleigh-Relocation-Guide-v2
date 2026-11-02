const assert=require('node:assert/strict'),api=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js'),{createSession}=require('./helpers/chat-isolated.cjs'),cases=require('./fixtures/chat-understanding-verified-frames.json');
(async()=>{for(const c of cases){
 const s=createSession('verified-'+c.id);for(const text of c.seed)await s.send(text);
 const before=s.audit().internalState,p=before.profile;
 const context={intent:before.intent,question:p.currentQuestionKey,booking:before.booking&&before.booking.step};
 const canonical=api.canonical(c.frame,c.message,context,engine);
 const response=await s.send(c.message,{canonical});
 if(c.replyPattern)assert.match(response.botMessage,new RegExp(c.replyPattern,'i'),c.id);
 if(c.completed)assert.equal(s.audit().internalState.completed,true,c.id);
 if(c.rental)assert.equal(s.audit().internalState.profile.pendingRentalPlan,true,c.id);
 if(c.id==='H06'){if(s.audit().internalState.profile.awaitingFirstName)await s.send('Alex');assert.equal(s.audit().internalState.intent,'investing');assert.equal(s.audit().serviceCalls.length,0);}
 if(c.kind==='unknown'||c.kind==='clarify')assert.equal(s.audit().internalState.profile.currentQuestionKey,p.currentQuestionKey,c.id+' must not advance');
 assert.equal(s.audit().blockedAttempts.length,0);
 assert.equal(s.audit().serviceCalls.some(call=>call.method==='book'),false);
 }console.log('Ten recorded live AI frames replay through the real conversation engine with safe routing and no booking writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
