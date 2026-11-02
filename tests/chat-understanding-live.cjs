// Real Cloudflare interpretations; ALL booking/lead/email operations remain
// isolated in createSession. No real appointment request is ever submitted.
const fs=require('node:fs'),assert=require('node:assert/strict'),api=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js'),{createSession}=require('./helpers/chat-isolated.cjs');
const endpoint=process.env.CHAT_AI_ENDPOINT||'https://lir-chat-understanding-test.benjamin-raleighrealtor.workers.dev/interpret';
const cases=[
 {id:'H01',seed:[],message:'wanna purchse a place round raleigh',kind:'answer'},
 {id:'H02',seed:['We are buying and moving from Texas.','Alex'],message:'could i get an actual person pls',kind:'human',reply:/919.?737.?7896/},
 {id:'H03',seed:['We are buying and moving from Texas.','Alex'],message:'can i ask u somethin real quick',kind:'preamble',reply:/what.*question/i},
 {id:'H04',seed:['We are buying and moving from Texas.','Alex'],message:'catch ya later',kind:'goodbye',completed:true},
 {id:'H05',seed:['We are buying and moving from Texas.','Alex'],message:'wait im not followin what u mean',kind:'clarify'},
 {id:'H06',seed:[],message:'im into househackin a duplex',intent:'investing'},
 {id:'H07',seed:[],message:'prolly lease a place there first then buy once we know the area',intent:'rent_then_buy',rental:true},
 {id:'H08',seed:['Book a call with Ricardo about buying.'],message:'can somebody real help me',kind:'human',reply:/919.?737.?7896/},
 {id:'H09',seed:['We are buying and moving from Texas.','Alex'],message:'whats the min downpayment usually',kind:'question',reply:/lender/i},
 {id:'H10',seed:['We are buying and moving from Texas.','Alex'],message:'my sandwich was delicious',kind:'unknown'},
];
(async()=>{const out=[];for(const c of cases){
 const s=createSession(c.id,{label:'Live interpretation '+c.id});for(const t of c.seed)await s.send(t);
 const a=s.audit(),p=a.internalState.profile,b=a.internalState.booking;
 const context={intent:a.internalState.intent,question:p.currentQuestionKey,booking:b&&b.step,awaitingFirstName:p.awaitingFirstName,known:p,history:a.internalState.history.slice(-4)};
 const start=Date.now();const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:8777'},body:JSON.stringify({message:c.message,context:{...context,booking:!!context.booking},known:{originCode:p.originCode},history:context.history.map(t=>({role:t.byUser?'user':'assistant',content:api.scrub(t.text)}))})});
 const body=await response.json(),issues=[];let reply;
 if(!body.ok)issues.push('No AI interpretation: '+(body.reason||body.error));
 else {
  if(c.kind&&body.interpretation.kind!==c.kind)issues.push('Expected kind '+c.kind+', got '+body.interpretation.kind);
  if(c.intent&&!(Array.isArray(c.intent)?c.intent:[c.intent]).includes(body.interpretation.intent))issues.push('Expected intent '+c.intent+', got '+body.interpretation.intent);
  const canonical=api.canonical(body.interpretation,c.message,context,engine);
  reply=(await s.send(c.message,{canonical})).botMessage;
  if(c.reply&&!c.reply.test(reply))issues.push('Expected reply '+c.reply);
  if(c.completed&&!s.audit().internalState.completed)issues.push('Did not complete');
  if(['clarify','unknown'].includes(c.kind)&&s.audit().internalState.profile.currentQuestionKey!==p.currentQuestionKey)issues.push('Clarification advanced the current question');
  if(c.id==='H06'&&s.audit().internalState.profile.awaitingFirstName)await s.send('Alex');
  if(c.id==='H06'&&s.audit().internalState.intent!=='investing')issues.push('Investor interpretation did not reach investor flow');
  if(c.rental&&!s.audit().internalState.profile.pendingRentalPlan)issues.push('Rental interpretation did not reach rental qualifier');
 }
 assert.equal(s.audit().blockedAttempts.length,0);
 out.push({id:c.id,message:c.message,response:body,reply,latencyMs:Date.now()-start,issues,audit:s.audit()});
 console.log(JSON.stringify({id:c.id,issues,latencyMs:out.at(-1).latencyMs}));
 await new Promise(resolve=>setTimeout(resolve,5500));
 }fs.mkdirSync('output/chat-understanding',{recursive:true});fs.writeFileSync('output/chat-understanding/live-results.json',JSON.stringify(out,null,2));console.log(JSON.stringify({total:out.length,passed:out.filter(c=>!c.issues.length).length}));
 if(out.some(c=>c.issues.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
