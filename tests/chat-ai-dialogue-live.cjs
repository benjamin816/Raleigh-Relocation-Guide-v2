// A frozen end-to-end dialogue review. Real Cloudflare inference, real local
// routing, fake calendar/lead/email boundaries. Never creates an appointment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const allFixtures=require('./fixtures/chat-ai-dialogue-review.json');
const fixtures=process.env.CHAT_DIALOGUE_IDS?allFixtures.filter(f=>process.env.CHAT_DIALOGUE_IDS.split(',').includes(f.id)):allFixtures;
const api=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js');
const helper=require.resolve('./helpers/chat-isolated.cjs');
const currentSession=require(helper).createSession;
const baseline=path.resolve('output/chat-understanding/pre-detour-widget.js');
let previousSession;
if(fs.existsSync(baseline)){
 process.env.CHAT_TEST_SOURCE=baseline;delete require.cache[helper];previousSession=require(helper).createSession;
 delete process.env.CHAT_TEST_SOURCE;delete require.cache[helper];
}
const endpoint=process.env.CHAT_AI_ENDPOINT||'https://lir-chat-understanding-test.benjamin-raleighrealtor.workers.dev/interpret';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastRequest=Date.now(),network=[];
const phase=s=>({intent:s.intent,question:s.profile.currentQuestionKey||'',booking:s.booking?.step||'',name:!!s.profile.awaitingFirstName});
function check(turn,reply,before,audit){
 const issues=[];
 if(turn.match&&!new RegExp(turn.match,'i').test(reply))issues.push('Missing expected answer: '+turn.match);
 if(turn.not&&new RegExp(turn.not,'i').test(reply))issues.push('Unexpected response: '+turn.not);
 if(turn.stable&&JSON.stringify(phase(audit.internalState))!==JSON.stringify(phase(before)))issues.push('Detour changed the pending step');
 if(turn.intent&&audit.internalState.intent!==turn.intent)issues.push('Wrong intent: '+audit.internalState.intent);
 if(turn.origin&&audit.internalState.profile.originCode!==turn.origin)issues.push('Missing origin '+turn.origin);
 if(turn.completed&&!audit.internalState.completed)issues.push('Did not complete');
 if(turn.ended&&!audit.internalState.ended)issues.push('Did not end repeated spam');
 if(turn.noSlots&&audit.serviceCalls.length)issues.push('Unexpected availability request');
 if(audit.serviceCalls.some(c=>c.method==='book')||audit.blockedAttempts.length)issues.push('Unexpected write/external attempt');
 return issues;
}
(async()=>{
 const results=[];
 for(const fixture of fixtures){
  const s=currentSession(fixture.id),oldRules=previousSession?.(fixture.id+'-old-rules'),oldHybrid=previousSession?.(fixture.id+'-old-hybrid');
  const client=api.create({engine,endpoint,knowledgeVersion:'2026-11-02-test6',fetch:async(url,init)=>{
   lastRequest=Date.now();const start=Date.now();
   try{const response=await fetch(url,{...init,headers:{...init.headers,Origin:'http://127.0.0.1:8777'}});const body=await response.clone().json();network.push({message:JSON.parse(init.body).message,body,latencyMs:Date.now()-start});return response;}
   catch(error){network.push({message:JSON.parse(init.body).message,error:error.name,latencyMs:Date.now()-start});throw error;}
  }});
  const turns=[];
  for(const turn of fixture.turns){
   const before=s.audit().internalState,p=before.profile;
   const context={intent:before.intent,question:p.currentQuestionKey,booking:before.booking?.step,contact:!!before.contact,awaitingFirstName:!!p.awaitingFirstName,ended:before.ended,known:p,history:before.history.slice(-4)};
   if(api.eligible(turn.text,context,engine)&&api.directMeaning(turn.text,context,engine)===null)await sleep(Math.max(0,5600-(Date.now()-lastRequest)));
   const interpretation=await client.interpret(turn.text,context);
   const reply=(await s.send(turn.text,interpretation)).botMessage,audit=s.audit();
   const result={text:turn.text,mode:interpretation.mode,interpretation,reply,issues:check(turn,reply,before,audit),phase:phase(audit.internalState)};
   if(oldRules){let b=oldRules.audit().internalState,r=(await oldRules.send(turn.text)).botMessage;result.previousRules={reply:r,issues:check(turn,r,b,oldRules.audit())};}
   if(oldHybrid){let b=oldHybrid.audit().internalState,r=(await oldHybrid.send(turn.text,{canonical:interpretation.canonical})).botMessage;result.previousRouting={reply:r,issues:check(turn,r,b,oldHybrid.audit())};}
   turns.push(result);
   assert.equal(audit.blockedAttempts.length,0);assert.equal(audit.serviceCalls.some(c=>c.method==='book'),false);
  }
  results.push({id:fixture.id,label:fixture.label,turns,passed:turns.every(t=>!t.issues.length)});
  console.log(JSON.stringify({id:fixture.id,passed:results.at(-1).passed,issues:turns.filter(t=>t.issues.length).map(t=>({text:t.text,issues:t.issues,reply:t.reply}))}));
  fs.mkdirSync('output/chat-understanding',{recursive:true});fs.writeFileSync('output/chat-understanding/dialogue-review.json',JSON.stringify({results,network},null,2));
 }
 const summary={conversations:results.length,passed:results.filter(s=>s.passed).length,turns:results.reduce((n,s)=>n+s.turns.length,0),liveRequests:network.length,aiTurns:results.flatMap(s=>s.turns).filter(t=>t.mode==='ai').length,failures:results.flatMap(s=>s.turns.filter(t=>t.issues.length).map(t=>({id:s.id,text:t.text,issues:t.issues}))),previousRulesFailedConversations:previousSession?results.filter(s=>s.turns.some(t=>t.previousRules?.issues.length)).length:null,previousRoutingFailedConversations:previousSession?results.filter(s=>s.turns.some(t=>t.previousRouting?.issues.length)).length:null};
 fs.writeFileSync('output/chat-understanding/dialogue-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 if(summary.failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
