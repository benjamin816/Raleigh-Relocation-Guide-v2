// Fresh complete journeys: real conversation logic, no live leads or calendar writes.
const fs=require('node:fs'), assert=require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
const cases=[
 ['Relocation from Minnesota','Buying a home; moving from Minnesota.'],
 ['Moving typo','movng to raleigh'],
 ['Out-of-state typo','mving from out of state'],
 ['Purchase synonym','Purchase a home'],
 ['Boise family','Moving to Cary',{origin:'Boise',reason:'Family',family:'Cary'}],
 ['Terminal illness','Moving from Idaho',{reason:'My mother in law lives in Cary and is terminally ill so we want to be close to her.',sensitive:true}],
 ['California affordability','Looking to buy; moving from CA',{reason:'Prices are too high where we live.'}],
 ['Texas weather','Moving to Raleigh from TX',{reason:'Better weather and more space.'}],
 ['Job relocation','Moving from New York to buy a home',{reason:'A new job',job:'Cisco at RTP'}],
 ['Remote worker','Moving from Colorado to buy. I work remotely.',{remote:true}],
 ['Retired household','We are retired and moving from Florida to buy a home.',{retired:true}],
 ['No children','Buying in Raleigh, moving from Ohio. We do not have kids.',{noKids:true}],
 ['Schools priority','Buying in Raleigh, moving from Indiana',{priorities:'Schools',schools:true}],
 ['Commute priority','Moving from New Jersey to buy',{priorities:'Commute and shopping',commute:true}],
 ['Price priority','Moving from California to buy',{priorities:'Lower price and a large yard',budget:'700k'}],
 ['Unsure budget','Moving from New York to buy',{budget:'Not sure yet'}],
 ['Unsure financing','Moving from Pennsylvania to buy',{financing:'Not sure'}],
 ['Unsure timeline twice','Moving from Illinois to buy',{timing:'Not sure, just started looking',timingFollowup:'Still unsure'}],
 ['Near-term move','Moving from Maryland to buy',{timing:'In two months'}],
 ['January move','Moving from Virginia to buy',{timing:'January'}],
 ['Local renter','I live in Cary and want to buy',{local:true,tenure:'Renting'}],
 ['Local owner buying','I live in Apex and want to buy',{local:true,tenure:'I own my home',willSell:'No, keeping it'}],
 ['Sell and buy','I need to sell and buy here in Raleigh',{selling:true,combined:true}],
 ['Local seller','I want to sell my home in North Raleigh',{selling:true}],
 ['Local seller uncertain timing','I need to sell my home in Cary',{selling:true,timing:'Not sure yet',timingFollowup:'Next year'}],
 ['Only renting','I only want to rent in Raleigh',{rental:'12 months',expectNoBooking:true}],
 ['Short bridge rental','Moving from Boise and selling my home there; planning to rent in Raleigh first',{rental:'Two months then buying'}],
 ['Listing referral','Moving from Boise, need to sell there, and only want to rent in Raleigh',{rental:'12 months',referral:true}],
 ['No-property renter','Moving from Texas to rent. I do not have a home to sell.',{rental:'A year',expectNoBooking:true}],
 ['Rental service question','Do you help renters?',{rental:'12 months',expectNoBooking:true}],
 ['LTR investor','I want to buy an LTR investment in Raleigh',{investor:true}],
 ['STR investor','Interested in STRs and investing in Raleigh',{investor:true}],
 ['House hacker','Thinking about househacking in Raleigh',{investor:true}],
 ['ADU investor','I want an ADU investment in Raleigh',{investor:true}],
 ['MTR investor','Looking for a mid-term rental investment',{investor:true}],
 ['Question detour','Moving from Wisconsin to buy a home',{detour:'What down payment would I need?'}],
 ['Question preamble','Moving from Michigan to buy',{detour:'I have a question',questionFollowup:'How does buying a home work?'}],
 ['Direct human request','Moving from Oregon to buy',{detour:'Can I talk to a human?'}],
 ['Named Benjamin request','Can I book a phone call with Benjamin about buying?',{direct:true,host:'Benjamin'}],
 ['Named Ricardo request','Can I book a phone call with Ricardo about buying?',{direct:true,host:'Ricardo'}],
 ['Saturday request','Book a video call about buying',{direct:true,saturday:true}],
 ['Explicit time request','Please book a phone call about buying',{direct:true,exactTime:true}],
 ['Call refusal','I want to buy in Raleigh from Ohio',{decline:true}],
 ['Name refusal','Moving to Raleigh from Delaware',{name:'No thanks'}],
 ['Name confusion','Moving to Raleigh from Massachusetts',{name:'what?',nameRetry:'Alex'}],
 ['Greeting first','hello',{followup:'Moving from Tennessee to buy a home'}],
 ['Not buying or selling','no',{followup:'Just browsing resources; not ready for a move',expectNoBooking:true}],
 ['Single home feature','Moving from Utah to buy',{home:'4 beds+',homeMore:'Two baths, 2000 square feet, large yard'}],
 ['Two home features','Moving from Nevada to buy',{home:'5 beds and 4 baths',homeMore:'2500 square feet and a large backyard'}],
 ['Gibberish then goodbye','hshsj',{followup:'goodbye',expectNoBooking:true}]
].map(([label,opening,options={}],i)=>({id:'R'+String(i+1).padStart(2,'0'),label,opening,...options}));
const defaults={location:'Moving from out of state',currentArea:'Cary',tenure:'Renting',firstTime:'Yes, first time',leaseEnd:'Next summer',willSell:'No, keeping it',whyRaleigh:'Better weather',familyNearby:'Cary',priorityFamilyArea:'Cary',priorities:'Parks and shopping',priorityMore:'No, those are the main things',commuteDestination:'RTP',commuteRange:'30 minutes maximum',priorityBudget:'550k',priorityFinancing:'Financing',areas:'Cary and Apex',areasReason:'Close to parks and shopping',home:'Four bedrooms, three bathrooms, a large yard',homeMore:'A one-story layout',budget:'550k',financing:'Financing',preapproval:'No, not approved',timing:'Next summer',timingReason:'Our lease ends',originHousing:'We have a home to sell',currentHome:'North Raleigh',ownedYears:'Eight years',whySell:'We need more space',whySellSolo:'We want to move closer to family',nextDestination:'Apex',nextAreaReason:'More space and the parks',nextHome:'Four bedrooms, three baths and a yard',sellingExperience:'We have sold before',local:'Out of state',experience:'First investment',strategy:'Long-term rental',investTiming:'This year',investAreas:'Raleigh',investGoals:'Cash flow',involvement:'Passive',investBudget:'450k',moveGoal:'Buying a home',salePriority:'Both',jobLocation:'Cisco at RTP',jobStart:'Next March'};
function answer(a,c,n){const st=a.internalState,p=st.profile,b=st.booking;
 if(p.awaitingFirstName)return c.nameRetry&&n.name?c.nameRetry:(c.name||'Alex');
 if(p.awaitingOriginState)return 'Idaho';
 if(p.pendingRentalPlan)return c.rental||'Two months then buying';
 if(p.awaitingTimelineClarification)return c.timingFollowup||'Next year';
 if(b){return ({choose:'The first one',format:'Video, please',email:'release-test@example.com',phone:'9195550102',name:'Alex Morgan',purpose:'Buying a home',notes:'Please discuss our move. This is an isolated test.'})[b.step]||null;}
 if(!st.intent)return c.followup||'Moving from Ohio to buy a home';
 const key=p.currentQuestionKey;
 if(!key&&st.intent==='relocating')return c.origin||'Moving from Minnesota';
 if(key==='goals')return 'Cash flow';
 if(key==='location')return c.local?'I live in Cary':c.origin||'Moving from Minnesota';
 if(key==='whyRaleigh')return c.reason||'Better weather';
 if(/familyNearby|priorityFamilyArea/.test(key))return c.family||'Cary';
 if(key==='priorities')return c.priorities||'Parks and shopping';
 if(key==='tenure')return c.tenure||'Renting';
 if(key==='willSell')return c.willSell||'No, keeping it';
 if(key==='timing'&&n[key])return c.timingFollowup||'Next year';
 if(c[key]!==undefined)return c[key];
 return defaults[key]||null;
}
(async()=>{const results=[];for(const c of cases){const s=createSession(c.id,{label:c.label});const issues=[],counts={};let r=await s.send(c.opening),detoured=false,preference=false;
 for(let turn=0;turn<40;turn++){
  let a=s.audit(),p=a.internalState.profile,b=a.internalState.booking;
  if(a.outcome==='confirmed'||a.internalState.ended||a.internalState.completed)break;
  if(c.expectNoBooking&&p.rentalOnly){await s.send('Thanks, goodbye');break;}
  if(c.investor&&a.serviceCalls.length)issues.push('Investor entered booking service');
  if(c.sensitive&&a.transcript.some(t=>/terminally ill/.test(t.user))&&!a.transcript.some(t=>/sorry/i.test(t.bot)))issues.push('Missing sympathy');
  if(c.detour&&!detoured&&p.currentQuestionKey==='areas'){detoured=true;await s.send(c.detour);if(c.questionFollowup)await s.send(c.questionFollowup);continue;}
  if(c.decline&&b){await s.send('No thanks. I do not want to schedule a call.');break;}
  if((c.saturday||c.exactTime)&&b?.step==='choose'&&!preference){preference=true;await s.send(c.saturday?'Any Saturday options?':'Do you have Saturday at 1p?');continue;}
  if((p.informationOnly||c.investor)&&!b&&turn>2&&(/\[LINK\]|reach back|resources|happy to help|what would/i.test(r.botMessage))){await s.send('Thanks, goodbye');break;}
  const key=p.awaitingFirstName?'name':p.currentQuestionKey;const text=answer(a,c,counts);if(!text){issues.push('No appropriate continuation for '+key+' / '+b?.step);break;}
  counts[key]=(counts[key]||0)+1;if(counts[key]>3&&!b){issues.push('Repeated qualification question: '+key);break;}
  r=await s.send(text);if(!r.botMessage&&!r.terminal)issues.push('Blank reply');
 }
 const a=s.audit();if(a.blockedAttempts.length)issues.push('Attempted an unmocked side effect');
 const books=a.serviceCalls.filter(x=>x.method==='book');
 if(c.expectNoBooking&&books.length)issues.push('Booked inappropriate appointment');
 if(c.host&&books.length&&books[0].args[0].preferredHost!==c.host)issues.push('Requested host missing from booking payload');
 if(!c.expectNoBooking&&!c.decline&&!c.investor&&a.outcome!=='confirmed')issues.push('Did not reach confirmation');
 if(c.referral&&books.length&&books[0].args[0].durationMinutes!==15)issues.push('Referral duration incorrect');
 if(c.sensitive&&a.internalState.profile.originCode!=='ID')issues.push('Relative location overwrote visitor origin');
 if(c.selling&&a.internalState.intent!=='selling')issues.push('Seller intent lost to move motivation');
 if(c.investor&&!a.transcript.some(t=>/\/invest\//.test(t.bot)))issues.push('Investor consult link missing');
 if(c.noKids||c.retired){if(a.transcript.some(t=>t.turn>2&&/like[^?]*schools/i.test(t.bot)))issues.push('Inappropriate school follow-up');}
 if(c.remote||c.retired){if(a.transcript.some(t=>/where.*commut|comfort level.*commut/i.test(t.bot)))issues.push('Inappropriate commute follow-up');}
 if(c.name==='what?'&&a.transcript.some(t=>/Nice to meet you, What/i.test(t.bot)))issues.push('Confusion accepted as name');
 results.push({...a,issues:[...new Set(issues)]});
 }
 const dir='output/chat-release-2026-11-02';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/journeys.json',JSON.stringify(results,null,2));
 const failed=results.filter(r=>r.issues.length);console.log(JSON.stringify({total:results.length,passed:results.length-failed.length,failed:failed.map(a=>({id:a.sessionId,label:a.metadata.label,issues:a.issues,last:a.transcript.slice(-2)}))},null,2));
 if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
