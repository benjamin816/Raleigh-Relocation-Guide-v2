// Independent first-pass batch. Does not modify the application or call live services.
const fs=require('node:fs');
const {createSession}=require('./helpers/chat-isolated.cjs');
const originalCases=[
 ['One-line detailed relocation','My wife and I are buying in Raleigh. We live in Maine, own a house to sell, want 3 beds and 2 baths near parks, and our budget is $620k.',{originCode:'ME'}],
 ['Missing letters','im relocting frm michigan to raliegh',{origin:'Michigan',originCode:'MI'}],
 ['Casual purchase spelling','wanna purchse a house around cary',{origin:'Atlanta',originCode:'GA'}],
 ['Apostrophe name',"We're relocating from Vermont to buy",{name:"O'Connor",fullName:"O'Connor Lane",originCode:'VT'}],
 ['Hyphenated name','We want to buy a place after moving from Kansas',{name:'Mary-Jane',fullName:'Mary-Jane Brooks',originCode:'KS'}],
 ['Ambiguous city','Moving from Portland to Raleigh to buy',{originState:'Oregon',originCode:'OR'}],
 ['Origin correction','We are moving from Seattle and buying a home',{injectKey:'priorities',inject:'Actually I meant Portland, Oregon, not Seattle.',originState:'Oregon',originCode:'OR'}],
 ['Family address is not mine','Moving from Oklahoma to buy',{reason:'My parents live in Apex and we miss seeing them.',originCode:'OK',family:'Apex'}],
 ['Mother has cancer','Moving from Kentucky to buy',{reason:'Our mom is in Raleigh and has cancer.',sympathy:true,originCode:'KY'}],
 ['Sick of snow idiom','Moving from North Dakota to buy',{reason:'We are sick of snow and want milder winters.',noSympathy:true,originCode:'ND'}],
 ['Sick of paying rent idiom','Moving from Alabama to buy',{reason:'I am sick of paying so much rent.',originHousing:'We currently rent',noSympathy:true,originCode:'AL'}],
 ['Not a new job','Moving from Indiana to buy',{reason:'I lost my job so we are moving closer to relatives.',noCongratulations:true,originCode:'IN',family:'Morrisville'}],
 ['Remote and family','Buying in Raleigh, relocating from New Mexico. Both of us work from home.',{reason:'Being near family',family:'Holly Springs',remote:true,originCode:'NM'}],
 ['Retired school omission','Buying a home near Raleigh; we are retired and currently live in Montana.',{retired:true,originCode:'MT',priorities:'Quiet streets'}],
 ['No kids explicit','We are child-free and buying in Raleigh from Missouri. We have no kids.',{noKids:true,originCode:'MO',priorities:'Parks'}],
 ['Commute change to remote','Moving from Connecticut to buy',{priorities:'An easy commute and parks',injectKey:'commuteDestination',inject:'Actually my employer just approved full-time remote work.',remote:true,originCode:'CT'}],
 ['Commute destination in opening','Buying here from South Dakota. I will commute to Duke in Durham and want the drive under 25 minutes.',{originCode:'SD'}],
 ['Unknown area preference','Moving from Nebraska to buy',{areas:'I have no idea yet',originCode:'NE'}],
 ['Affordable plus garden','Buying near Raleigh, relocating from Louisiana',{priorities:'Affordable and space for gardening',budget:'Four hundred fifty thousand max',expectedBudget:450000,originCode:'LA'}],
 ['Budget correction','Relocating from Iowa and buying here',{budget:'425k, not 625k',expectedBudget:425000,originCode:'IA'}],
 ['Funding negation','Moving from Arkansas to buy',{financing:'Not cash. We need a mortgage.',expectedFunding:true,originCode:'AR'}],
 ['Preapproval negative','Moving from New Hampshire to buy',{financing:'Financing',preapproval:'Not pre-approved yet',notApproved:true,originCode:'NH'}],
 ['Preapproval already supplied','We are pre-approved and buying here after moving from West Virginia.',{originCode:'WV',approved:true}],
 ['Local renter lease date','I currently rent in Garner and want to purchase my first home. My lease expires next May.',{local:true,tenure:'Renting',leaseEnd:'May',areas:'Garner because of the parks'}],
 ['Local owner keeping home','I live in Morrisville and want to buy another primary home. Keeping this one, not selling.',{local:true,tenure:'I own it',willSell:'No, keeping it'}],
 ['Motivated seller','I am selling my home in Holly Springs',{selling:true,whySellSolo:'We want to move closer to our grandkids',nextDestination:'Charlotte'}],
 ['Sale plus purchase correction','I need to sell my home in Durham',{selling:true,injectKey:'ownedYears',inject:'Actually we will buy a new home in Raleigh too.',combined:true}],
 ['Divorce sensitive sale','I need to sell our house in Cary because we are getting divorced.',{selling:true,noCongratulations:true,nextDestination:'An apartment in Raleigh'}],
 ['Temporary rent bridge','Moving from Pittsburgh, selling our house there, and renting first.',{rental:'About eight weeks, then buy',bridge:true}],
 ['Long rental listing referral','Selling our home in Salt Lake City and moving to Raleigh to rent for at least a year.',{referral:true,rental:'12 months'}],
 ['Middle rental horizon','Moving from Sacramento to Raleigh and will rent first.',{rental:'Five months',rentalClarify:'We will buy after five months',bridge:true}],
 ['Rental only no property','Relocating from Alaska to rent a place. No home to sell.',{rental:'Eighteen months',noBook:true}],
 ['Cash-flow investor','Want to buy a cashflow property in Raleigh',{investor:true}],
 ['BRRRR investor','Thinking of a BRRRR in Raleigh. Already own two rentals.',{investor:true}],
 ['House-hack spacing','I want to house-hack around Raleigh',{investor:true}],
 ['1031 exchange','I need to buy in Raleigh for a 1031 exchange',{investor:true}],
 ['Investor resource detour','Want to invest in a duplex here',{investor:true,injectKey:'experience',inject:'Do you have a calculator to compare the numbers?',calculator:true}],
 ['Name confusion without punctuation','Moving from Rochester NY to buy',{name:'huh',nameRetry:'Morgan',rejectName:'Huh',originState:'New York'}],
 ['Price question detour','Moving from Baltimore to buy',{injectKey:'areas',inject:'I have a question',injectFollowup:'What would closing costs include?'}],
 ['Phone request during qualification','Moving from Boston to buy',{injectKey:'home',inject:'Can you give me Ben’s phone number?',phoneResponse:true}],
 ['Thursday acceptance','Could we arrange a phone call to discuss buying?',{direct:true,choice:'Thursday works',expectChoice:true}],
 ['Friday acceptance','Can we set up a video call about selling?',{direct:true,selling:true,choice:'Friday is good',expectChoice:true}],
 ['Evening shorthand acceptance','I would like to schedule a phone call about buying',{direct:true,choice:'5p works for me',expectChoice:true}],
 ['Second option wording','Please arrange a video call about buying',{direct:true,choice:'Let’s go with the latter',expectChoice:true}],
 ['Ricardo host then date','Please schedule a video call with Ricardo about buying',{direct:true,host:'Ricardo',choice:'the Friday one'}],
 ['Switch preferred host','Book a phone call with Benjamin about buying',{direct:true,injectBooking:'Can we meet with Ricardo instead?',host:'Ricardo'}],
 ['Invalid email correction','I would like to book a call about buying',{direct:true,invalidEmail:true}],
 ['No phone number','Could I book a call to discuss buying?',{direct:true,refusePhone:true,noBook:true}],
 ['Question while choosing time','Please set up a phone call about buying',{direct:true,injectBooking:'Before I pick, can I speak to a person?',phoneResponse:true}],
 ['Spam warning then recovery','Looking to buy a home in Raleigh',{injectKey:'location',inject:'asdfghjkl',mustStayQuestion:true,origin:'Tampa'}]
].map(([label,opening,opts={}],i)=>({id:'N'+String(i+1).padStart(2,'0'),label,opening,...opts}));
const cases=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')).cases:originalCases;
const answers={currentArea:'Garner',tenure:'We rent our current place',firstTime:'This will be our first purchase',leaseEnd:'Our lease is up in May',willSell:'We will sell it',whyRaleigh:'We want a milder climate and a fresh start',familyNearby:'Morrisville',priorityFamilyArea:'Morrisville',originHousing:'We own a home and will sell it before moving',priorities:'Walkable parks and groceries nearby',priorityMore:'Good access to groceries would be helpful',commuteDestination:'Duke Hospital',commuteRange:'Ideally 20 minutes; 35 would be my limit',priorityBudget:'650k ceiling',priorityFinancing:'We will use a mortgage',areas:'Morrisville and Cary',areasReason:'To be close to greenways',home:'Three bedrooms, two full baths, and a fenced yard',homeMore:'Also a first-floor primary bedroom',budget:'650k ceiling',financing:'We will use a mortgage',preapproval:'We still need a lender',timing:'Next fall',timingReason:'That is when the lease ends',currentHome:'Holly Springs',ownedYears:'We have owned it for nine years',whySell:'We have outgrown it',whySellSolo:'We need to downsize',nextDestination:'Raleigh',nextAreaReason:'Closer to work',nextHome:'Four bedrooms, office space and a garage',sellingExperience:'We have sold two homes before',moveGoal:'We plan to buy',jobLocation:'Duke Hospital',jobStart:'April of next year',experience:'This would be our first investment',strategy:'A duplex for long-term rentals',goals:'Long-term appreciation',involvement:'I want it fairly passive',salePriority:'Both'};
function continuation(a,c,counts){const st=a.internalState,p=st.profile,b=st.booking;
 if(p.pendingRentalSale)return c.originHousing||'We will sell our current home';
 if(p.pendingRentalPlan)return counts.rental?c.rentalClarify||c.rental||'Three months, then buying':c.rental||'Three months, then buying';
 if(p.awaitingFirstName)return counts.firstName?c.nameRetry||'Morgan':c.name||'Morgan';
 if(p.awaitingOriginState)return c.originState||'Florida';
 if(p.awaitingTimelineYear)return 'Next year, but nothing is firm';
 if(b){if(b.step==='choose')return c.choice||(b.slots.length===1?'The first option':'The second option');if(b.step==='format')return c.phone?'Phone please':'Video is fine';if(b.step==='email')return c.invalidEmail&&!counts.invalidEmail?'morgan-at-example-dot-com':'morgan.test@example.com';if(b.step==='phone')return c.refusePhone?'I prefer not to give my phone number':'(919) 555-0143';if(b.step==='name')return c.fullName||'Morgan Blake';if(b.step==='purpose')return c.selling?'Selling our house':'Buying a home';if(b.step==='notes')return 'A garage workshop is on our wish list. Please keep that in the notes.';return null;}
 if(!st.intent)return 'We are looking to buy and are relocating from Florida';
 const k=p.currentQuestionKey;if(!k||k==='location')return c.local?'We live in Garner':c.origin||'We currently live in Tampa, Florida';
 if(k==='familyNearby'||k==='priorityFamilyArea')return c.family||'Morrisville';
 if(k==='whyRaleigh')return c.reason||answers.whyRaleigh;
 if(k==='priorityBudget'&&c.budget)return c.budget;
 if(c[k]!==undefined)return c[k];return answers[k]||null;
}
(async()=>{const out=[];for(const c of cases){const s=createSession(c.id,{label:c.label,...c.metadata});const issues=[],counts={},evidence=[],stepsDone=new Set();let inject=false,bookInject=false,closed=false;
 function checkResult(check,before,after,reply){
  if(!check)return;
  const at=key=>key.split('.').reduce((a,k)=>a==null?undefined:a[k],after.internalState);
  if(check.includes&&!new RegExp(check.includes,'i').test(reply))issues.push('missing-reply:'+check.includes);
  if(check.excludes&&new RegExp(check.excludes,'i').test(reply))issues.push('unwanted-reply:'+check.excludes);
  if(check.sameQuestion&&before.internalState.profile.currentQuestionKey!==after.internalState.profile.currentQuestionKey)issues.push('detour-lost-current-question');
  for(const [key,value] of Object.entries(check.state||{}))if(JSON.stringify(at(key))!==JSON.stringify(value))issues.push('state-mismatch:'+key+'='+JSON.stringify(at(key)));
  if(check.noBook&&after.serviceCalls.some(x=>x.method==='book'))issues.push('unexpected-booking-after-step');
 }
 async function send(t,check){const before=s.audit();const r=await s.send(t);const after=s.audit();evidence.push({user:t,keyBefore:before.internalState.profile.currentQuestionKey||'',bookingBefore:before.internalState.booking?.step||'',response:r.botMessage});
  checkResult(check,before,after,r.botMessage);
  if(!r.botMessage&&!after.internalState.ended&&!after.internalState.completed)issues.push('blank-response');
  if(c.noSympathy&&/sick of/.test(t)&&/sorry to hear/i.test(r.botMessage))issues.push('literal-illness-reply-to-an-idiom');
  if(c.noCongratulations&&/job|divorc/i.test(t)&&/congrats|congratulations|super exciting/i.test(r.botMessage))issues.push('inappropriate-celebration');
  if(c.sympathy&&/cancer/i.test(t)&&!/sorry/i.test(r.botMessage))issues.push('missing-sympathy');
  if(c.phoneResponse&&t=== (c.inject||c.injectBooking)&&!/919.?737.?7896/.test(r.botMessage))issues.push('direct-contact-question-not-answered');
  if(c.rejectName&&new RegExp('Nice to meet you, '+c.rejectName,'i').test(r.botMessage))issues.push('confusion-accepted-as-a-name');
  if(c.mustStayQuestion&&t===c.inject&&before.internalState.profile.currentQuestionKey!==after.internalState.profile.currentQuestionKey)issues.push('gibberish-advanced-the-question');
  return r;
 }
 try{await send(c.opening,c.openingCheck);for(let turn=0;turn<45;turn++){
  const a=s.audit(),st=a.internalState,p=st.profile,b=st.booking;
  if(a.outcome==='confirmed'||st.ended||st.completed){closed=true;break;}
  const stage=p.pendingRentalPlan?'rental':p.awaitingFirstName?'firstName':b?'booking:'+b.step:p.currentQuestionKey||'origin';
  const stepIndex=(c.steps||[]).findIndex((step,index)=>!stepsDone.has(index)&&(step.at===stage||step.at==='any')&&(!step.afterTurns||a.transcript.length>=step.afterTurns));
  if(stepIndex>=0){const step=c.steps[stepIndex];stepsDone.add(stepIndex);await send(step.text,step.check);continue;}
  if((p.rentalOnly||p.informationOnly)&&c.noBook){await send('Thanks, that answers my question. Goodbye.');closed=true;break;}
  if(c.investor&&a.transcript.some(t=>/Book an investing exploration call/.test(t.bot))){await send('Thanks, I will use that investor booking link. Goodbye.');closed=true;break;}
  if(!inject&&c.injectKey&&c.injectKey===p.currentQuestionKey&&!p.awaitingFirstName){inject=true;await send(c.inject);if(c.injectFollowup)await send(c.injectFollowup);continue;}
  if(!bookInject&&c.injectBooking&&b?.step==='choose'){bookInject=true;await send(c.injectBooking);continue;}
  const text=continuation(a,c,counts);const key=p.pendingRentalPlan?'rental':p.awaitingFirstName?'firstName':b?b.step:p.currentQuestionKey||'origin';
  if(!text){issues.push('unhandled-test-continuation:'+key);break;}
  if((counts[key]||0)>=2){issues.push('stuck-repeating:'+key);await send('I already answered that. I will call the team directly. Goodbye.');closed=true;break;}
  if(c.invalidEmail&&b?.step==='email'&&!counts.invalidEmail)counts.invalidEmail=1;
  counts[key]=(counts[key]||0)+1;
  const result=await send(text);
  if(c.expectChoice&&b?.step==='choose'&&!s.audit().internalState.booking?.start)issues.push('offered-time-acceptance-not-understood');
  if(c.refusePhone&&b?.step==='phone'){if(s.audit().serviceCalls.some(x=>x.method==='book'))issues.push('booked-without-required-phone');await send('Okay, I will call the team myself. Goodbye.');closed=true;break;}
 }
 const a=s.audit(),p=a.internalState.profile,books=a.serviceCalls.filter(x=>x.method==='book');
 checkResult(c.finalCheck,a,a,a.transcript.at(-1)?.bot||'');
 if(c.steps&&stepsDone.size!==c.steps.length)issues.push('test-step-not-reached:'+c.steps.filter((_,i)=>!stepsDone.has(i)).map(x=>x.at).join(','));
 if(c.expectedStart&&books.some(x=>x.args[0].start!==c.expectedStart))issues.push('wrong-exact-slot');
 if(c.expectedCallType&&books.some(x=>x.args[0].callType!==c.expectedCallType))issues.push('wrong-call-format');
 if(a.blockedAttempts.length)issues.push('unmocked-external-operation');
 if(c.noBook&&books.length)issues.push('unwanted-booking');
 if(c.investor&&a.serviceCalls.length)issues.push('investor-used-chat-booking');
 if(c.host&&books.some(x=>x.args[0].preferredHost!==c.host))issues.push('wrong-host-request');
 if(c.choice&&!c.expectedStart&&/Friday/i.test(c.choice)&&books.some(x=>!x.args[0].start.startsWith('2026-11-06')))issues.push('wrong-day-selected-from-acceptance');
 if(c.expectedBudget&&p.priorityBudgetAmount!==c.expectedBudget)issues.push('budget-correction-not-retained');
 if(c.expectedFunding&&p.usingFinancing!==true)issues.push('financing-negation-not-retained');
 if(c.notApproved&&p.preApproved===true)issues.push('negative-preapproval-read-as-approved');
 if(c.originCode&&p.originCode!==c.originCode)issues.push('origin-not-retained:'+p.originCode);
 if(c.combined&&books.some(x=>x.args[0].purpose!=='Buy and Sell'))issues.push('combined-purpose-lost');
 if(c.referral&&books.some(x=>x.args[0].durationMinutes!==15||x.args[0].callType!=='phone'))issues.push('referral-format-or-duration-wrong');
 if(c.calculator&&!a.transcript.some(t=>/\/calculator\//.test(t.bot)))issues.push('calculator-request-not-answered');
 const remoteAt=c.injectKey==='commuteDestination'?a.transcript.findIndex(t=>t.user===c.inject):-1;
 if((c.remote||c.retired)&&a.transcript.some((t,i)=>(remoteAt<0||i>=remoteAt)&&/where.*commut|comfort level.*commut/i.test(t.bot)))issues.push('unnecessary-commute-question');
 if((c.noKids||c.retired)&&a.transcript.some(t=>/like[^?]*schools/i.test(t.bot)))issues.push('unnecessary-school-example');
 if(!c.noBook&&!c.investor&&a.outcome!=='confirmed')issues.push('journey-did-not-complete');
 if(!closed&&a.outcome!=='confirmed')issues.push('turn-limit-reached');
 out.push({...a,label:c.label,issues:[...new Set(issues)],evidence});
 }catch(e){out.push({...s.audit(),label:c.label,issues:[...new Set([...issues,'runtime:'+e.message])],evidence});}
 }
 const dir=process.argv[3]||'output/chat-fresh-50-batch2-2026-11-02';fs.mkdirSync(dir,{recursive:true});const target=dir+'/'+(process.env.CHAT_RESULT_FILE||'repaired-replay.json');if(target.endsWith('/first-pass.json')&&fs.existsSync(target))throw Error('Frozen first-pass results already exist; use a different replay filename.');fs.writeFileSync(target,JSON.stringify(out,null,2));
 console.log(JSON.stringify({total:out.length,turns:out.reduce((n,r)=>n+r.transcript.length,0),passing:out.filter(r=>!r.issues.length).length,flagged:out.filter(r=>r.issues.length).map(r=>({id:r.sessionId,label:r.label,issues:r.issues}))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
