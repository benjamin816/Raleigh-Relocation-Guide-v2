const assert=require('node:assert/strict');
const frames=require('./fixtures/chat-ai-dialogue-frames.json');
const rubric=require('./fixtures/chat-ai-dialogue-review.json');
const {createSession}=require('./helpers/chat-isolated.cjs');
const phase=s=>JSON.stringify({intent:s.intent,question:s.profile.currentQuestionKey||'',booking:s.booking?.step||'',name:!!s.profile.awaitingFirstName});
(async()=>{
 assert.equal(frames.length,20);let turns=0;
 for(const dialogue of frames){
  const test=rubric.find(f=>f.id===dialogue.id),s=createSession('AI-replay-'+dialogue.id);
  assert.equal(dialogue.turns.length,test.turns.length);
  for(let i=0;i<dialogue.turns.length;i++){
   const {text,interpretation}=dialogue.turns[i],expected=test.turns[i],before=s.audit().internalState;
   assert.equal(text,expected.text);
   const reply=(await s.send(text,interpretation)).botMessage,audit=s.audit(),label=dialogue.id+': '+text;
   if(expected.match)assert.match(reply,new RegExp(expected.match,'i'),label);
   if(expected.not)assert.doesNotMatch(reply,new RegExp(expected.not,'i'),label);
   if(expected.stable)assert.equal(phase(audit.internalState),phase(before),label);
   if(expected.intent)assert.equal(audit.internalState.intent,expected.intent,label);
   if(expected.origin)assert.equal(audit.internalState.profile.originCode,expected.origin,label);
   if(expected.completed)assert(audit.internalState.completed,label);
   if(expected.ended)assert(audit.internalState.ended,label);
   if(expected.noSlots)assert.equal(audit.serviceCalls.length,0,label);
   assert.equal(audit.blockedAttempts.length,0,label);assert.equal(audit.serviceCalls.some(c=>c.method==='book'),false,label);
   turns++;
  }
 }
 console.log(`Replayed ${frames.length} real-AI-reviewed dialogues / ${turns} visitor turns, including recorded safe fallbacks. No inference or writes during replay.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
