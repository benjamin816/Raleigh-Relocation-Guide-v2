// Fresh frozen dialogues; no production changes, no adaptive retries. Real AI
// inference, real conversation code, isolated calendar/lead/email boundaries.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixtures=require('./fixtures/chat-ai-independent-review.json');
const {createSession}=require('./helpers/chat-isolated.cjs');
const api=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js');
const dir='output/chat-ai-independent-review';fs.mkdirSync(dir,{recursive:true});
const phase=s=>({intent:s.intent,question:s.profile.currentQuestionKey||'',booking:s.booking?.step||'',name:!!s.profile.awaitingFirstName});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let lastRequest=Date.now();
function grade(turn,reply,before,audit){const issues=[];
 if(turn.match&&!new RegExp(turn.match,'i').test(reply))issues.push('Missing expected response: '+turn.match);
 if(turn.not&&new RegExp(turn.not,'i').test(reply))issues.push('Unexpected response: '+turn.not);
 if(turn.stable&&JSON.stringify(phase(before))!==JSON.stringify(phase(audit.internalState)))issues.push('Question detour changed the pending step');
 if(turn.intent&&audit.internalState.intent!==turn.intent)issues.push('Expected intent '+turn.intent+', got '+audit.internalState.intent);
 if(turn.origin&&audit.internalState.profile.originCode!==turn.origin)issues.push('Expected origin '+turn.origin);
 if(turn.completed&&!audit.internalState.completed)issues.push('Goodbye did not complete');
 if(turn.noSlots&&audit.serviceCalls.some(c=>c.method==='slots'))issues.push('Unexpected slot lookup');
 return issues;
}
(async()=>{const results=[],network=[];
 for(const f of fixtures){
  const s=createSession(f.id),prior=[];
  const client=api.create({engine,knowledgeVersion:'2026-11-02-test6',endpoint:'https://lir-chat-understanding-test.benjamin-raleighrealtor.workers.dev/interpret',fetch:async(url,init)=>{
   const at=Date.now();lastRequest=at;
   try{const r=await fetch(url,{...init,headers:{...init.headers,Origin:'http://127.0.0.1:8777'}});network.push({id:f.id,text:JSON.parse(init.body).message,ms:Date.now()-at,body:await r.clone().json()});return r;}
   catch(e){network.push({id:f.id,text:JSON.parse(init.body).message,ms:Date.now()-at,error:e.name});throw e;}
  }});
  const turns=[];
  for(const t of f.turns){
   const before=s.audit().internalState,p=before.profile;
   if(before.ended){turns.push({text:t.text,issues:['Conversation ended before this visitor turn']});break;}
   const context={intent:before.intent,question:p.currentQuestionKey,booking:before.booking?.step,contact:!!before.contact,awaitingFirstName:!!p.awaitingFirstName,ended:before.ended,known:p,history:before.history.slice(-4)};
   if(api.eligible(t.text,context,engine)&&api.directMeaning(t.text,context,engine)===null)await sleep(Math.max(0,6200-(Date.now()-lastRequest)));
   const interpretation=await client.interpret(t.text,context);
   // Identical prior state: replay ALL prior AI decisions, then remove AI for
   // this ONE turn. This is not a divergent rules-only conversation comparison.
   const counter=createSession(f.id+'-counter-'+turns.length);
   for(const old of prior)await counter.send(old.text,old.interpretation);
   assert.deepEqual(phase(counter.audit().internalState),phase(before));
   const rulesReply=(await counter.send(t.text)).botMessage;
   const reply=(await s.send(t.text,interpretation)).botMessage,audit=s.audit();
   const issues=grade(t,reply,before,audit),rulesIssues=grade(t,rulesReply,before,counter.audit());
   assert.equal(audit.blockedAttempts.length,0);assert.equal(audit.serviceCalls.some(c=>c.method==='book'),false);
   turns.push({text:t.text,before:phase(before),interpretation,reply,after:phase(audit.internalState),issues,rulesReply,rulesIssues,changed:rulesReply!==reply});
   prior.push({text:t.text,interpretation});
  }
  results.push({id:f.id,label:f.label,turns});
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({results,network},null,2));
  console.log(JSON.stringify({id:f.id,turns:turns.length,flagged:turns.filter(t=>t.issues.length).map(t=>({text:t.text,reply:t.reply,issues:t.issues})),aiChanged:turns.filter(t=>t.interpretation?.mode==='ai'&&t.changed).length}));
 }
 const turns=results.flatMap(r=>r.turns),summary={conversations:results.length,turns:turns.length,ai:turns.filter(t=>t.interpretation?.mode==='ai').length,rules:turns.filter(t=>t.interpretation?.mode==='rules').length,fallback:turns.filter(t=>t.interpretation?.mode==='fallback').length,requests:network.length,automaticallyFlagged:turns.filter(t=>t.issues.length).length,aiChangedReplies:turns.filter(t=>t.interpretation?.mode==='ai'&&t.changed).length};
 fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e);process.exitCode=1;});
