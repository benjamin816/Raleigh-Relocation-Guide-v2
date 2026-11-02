const assert=require('node:assert/strict'),api=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js');
(async()=>{
 const context={intent:'buying',question:'home',history:[]};
 const answer={kind:'answer',intent:'buying',certain:true,canonical:'I want to buy a home.'};
 let payload;
 const client=api.create({engine,endpoint:'https://ai.example.test/interpret',fetch:async(_,init)=>{payload=JSON.parse(init.body);return {ok:true,json:async()=>({ok:true,interpretation:answer})};}});
 const result=await client.interpret('wanna buy a place',{...context,known:{email:'secret@example.com',phone:'9195550143',originCode:'TX'},history:[{text:'Email person@example.com',byUser:true}]});
 assert.equal(result.mode,'ai');assert.equal(result.canonical,'I want to buy a home.');assert(!JSON.stringify(payload).includes('example.com'));assert.equal(payload.known.originCode,'TX');assert.equal(payload.known.email,undefined);
 let unnecessaryCalls=0;
 const fast=api.create({engine,endpoint:'https://ai.example.test',fetch:async()=>{unnecessaryCalls++;throw Error('must not need AI');}});
 for(const text of ['buy','BUY','purchase a home','sell','selling',"How's it going?",'How are you?']){
  const result=await fast.interpret(text,{intent:null,question:''});
  assert.equal(result.mode,'rules',text);assert(result.canonical,text);
 }
 assert.equal(unnecessaryCalls,0,'Clear goals and greetings cannot wait on AI');
 for(const frame of [{kind:'unknown',certain:false,canonical:''},{kind:'clarify',certain:true,canonical:'I do not understand.'}]){
  assert.equal(api.canonical(frame,'buy',{intent:null,question:''},engine),'buy','AI cannot reject an explicit buy answer');
 }
 for(const booking of ['email','phone','name','notes','format'])assert.equal(api.eligible('my details',{...context,booking},engine),false);
 assert.equal(api.eligible('Name',{...context,awaitingFirstName:true},engine),false);
 assert.equal(api.eligible('Friday at 5pm',{...context,booking:'choose'},engine),false);
 assert.equal(api.canonical({...answer,canonical:'I can spend 900000'},'about 500k',context,engine),'about 500k');
 assert.equal(api.canonical({...answer,canonical:'Book a call'},'Do not book a call',context,engine),'Do not book a call');
 assert.equal(api.canonical({...answer,canonical:'We will buy in cash'},'We will use financing',context,engine),'We will use financing');
 assert.equal(api.canonical({...answer,canonical:'We are buying'},'We are not buying, only renting',context,engine),'We are not buying, only renting');
 assert.equal(api.canonical({...answer,canonical:'Already pre-approved'},'Not pre-approved',{...context,question:'preapproval'},engine),'Not pre-approved');
 assert.equal(api.canonical({kind:'unknown',certain:false,canonical:''},'random unrelated thing',context,engine),'huh');
 assert.equal(api.canonical({kind:'clarify',certain:false,canonical:'I do not understand.'},'not followin',context,engine),'huh');
 assert.match(api.canonical({...answer,intent:'rent_then_buy',canonical:'We will lease first, then purchase.'},'lease first then buy',{...context,question:''},engine),/plan to rent temporarily before buying/);
 assert.match(api.canonical({...answer,intent:'renting',canonical:'We will lease for $2000'},'lease for $2000',{...context,question:''},engine),/^I am looking to rent\. lease for \$2000$/);
 assert.match(api.canonical({...answer,intent:'selling',canonical:'Need to offload my property.'},'need to offload my property',{...context,intent:null},engine),/^I want to sell a home/);
 assert.equal(api.canonical({kind:'human',certain:true,canonical:''},'can i talk to somebody',context,engine),'Can I speak with a team member?');
 assert.match(api.canonical({kind:'human',certain:true,canonical:''},'What is Ben’s number?',{...context,booking:'choose'},engine),/phone number.*Benjamin/);
 const offline=api.create({engine,endpoint:'https://ai.example.test',fetch:async()=>{throw Error('offline');}});
 assert.equal((await offline.interpret('want a home',context)).mode,'fallback');
 const timeout=api.create({engine,endpoint:'https://ai.example.test',timeout:5,fetch:(_,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(Error('abort'),{name:'AbortError'}))))});
 assert.equal((await timeout.interpret('want a home',context)).reason,'timeout');
 // Browser status is informational; the function applies only a bounded
 // interpretation and never receives calendar or lead-writing credentials.
 const source=require('node:fs').readFileSync('assets/js/raleigh-chat.js','utf8');
 assert.match(source,/generation!==incomingGeneration/);assert.match(source,/understanding\.cancel\(\)/);assert.match(source,/engine\.classifySafety\(originalValue/);
 console.log('AI client: protected fields, context redaction, semantic mapping, numeric/consent guards, offline fallback, timeout and reset protection passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
