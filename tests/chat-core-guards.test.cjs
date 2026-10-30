const assert=require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
const engine=require('../assets/js/raleigh-chat-engine.js');
const vm=require('node:vm'),fs=require('node:fs');const cfg={window:{}};vm.runInNewContext(fs.readFileSync('assets/js/raleigh-chat-config.js','utf8'),cfg);const config=cfg.window.RaleighChatConfig;
let checks=0;
function check(value,message){assert(value,message);checks++;}
async function talk(id,turns){const s=createSession(id);for(const t of turns){const r=await s.send(t);check(!!r.botMessage,id+': blank response');}check(s.audit().blockedAttempts.length===0,id+': live side effect');return s;}
function calls(s,method){return s.audit().serviceCalls.filter(c=>c.method===method);}
(async()=>{
 for(const phrase of ["Let's hold off on the call.","I'll pass on scheduling.","Stop the chat. I'm done, goodbye.","Not scheduling today.","Please cancel the scheduling flow."]){let s=await talk('boundary-'+checks,['Please book a phone call.',phrase]);check(s.audit().internalState.booking===null,phrase);check(calls(s,'suggest').length===0,'Refusal must not be a time query: '+phrase);}
 for(const phrase of ['No thanks, I only want resources.','No name yet, thanks.','No thanks. Can you give the buying page link?','No thanks, I am just watching videos.']){check(engine.declinesName(phrase),'name refusal');check(engine.extractFirstName(phrase)===null,'not a name');}
 const budget=await talk('correct-price',["I'm local, buying a condo. My budget is $500k.",'Alex','I own my current home.','No, keeping it.','Downtown Raleigh.','Restaurants and walking.','Two beds and a balcony.','My ceiling is actually 460k, not 500k.']);
 check(budget.audit().internalState.profile.priorityBudgetAmount===460000,'Last positive budget must be authoritative');
 for(const phrase of ['Cash, no mortgage.','Cash as I said; I will not need a lender.','All cash.'])check(engine.financingType(phrase)==='Cash','cash/negation '+phrase);
 check(engine.financingType('Not cash, I need a mortgage.')==='Financing','negative cash');
 const host=await talk('host-notes',['Please book a phone call with Ricardo about buying.','The second one.','host@example.com','9195550102','Taylor Reed','Phone call with Ricardo; buying next year.']);
 check(calls(host,'book').length===1,'Host note completes one booking');check(calls(host,'slots').length===1,'Host note must not restart slots');check(calls(host,'book')[0].args[0].preferredHost==='Ricardo','Requested host preserved');
 const sale=await talk('sale-notes',['Please book a phone call for selling.','The first one.','seller@example.com','9195550103','Jordan Lane','Sale only; no next purchase in Raleigh.']);
 check(calls(sale,'book').length===1,'Sale-only notes do not reopen qualification');check(calls(sale,'book')[0].args[0].purpose==='Sell','Sale purpose');
 const buyer=await talk('buyer-correction',["My spouse might sell her condo, but it is independent. I am buying a home in Raleigh for myself.",'Andy',"My primary goal is buying, not managing a sale.",'Can we schedule a phone call?','The second one.','buyer@example.com','9195550104','Andy Flores','Purchase only; spouse condo is independent.']);
 check(calls(buyer,'book').length===1,'Corrected buyer books');check(calls(buyer,'book')[0].args[0].purpose==='Buy','Buyer correction controls final payload');
 check(engine.transactionPlan('Sell our home, rent for two months between homes, then buy in Cary.').combined,'Bridge rental retains sale and purchase');
 check(engine.transactionPlan('Sell only; we do not need to buy anything.').sellThenRent===false,'No purchase is not a rental plan');
 check(engine.rentalOnly('Not buying or selling, just watching videos.')===false,'Browser is not a renter');
 check(engine.rentalOnly('I only want a short-term apartment. Not planning to purchase or sell.'),'Actual rental-only exit');
 const questions=[
 ['F04','What records should a buyer review about HOA dues and rules?',/dues.*cover|governing documents/],
 ['F15','What does a lender do and can closing costs be financed?',/lender reviews|loan options/],
 ['F23','What would a first-time buyer do before looking at houses?',/budget|lender/],
 ['F29','How do you determine a price from comparable sales?',/recent closed sales/],
 ['F33','Do we need to do repairs before deciding to sell?',/repair estimates|renovations/],
 ['F35','What repairs should a seller consider before listing?',/repairs|maintenance/],
 ['F38','How do we coordinate the two closings when selling and buying?',/timelines|closing arrangements/],
 ['F17','How long is the call usually?',/60 minutes/]
 ];
 for(const [id,q,expected] of questions){let s=await talk(id,[q]);check(expected.test(s.audit().transcript[0].bot),id+': useful answer before identity request');check(!s.audit().transcript[0].bot.includes('May I have your first name'),id+': no identity gate');}
 const resources=await talk('resource-detour',['I only want investing resources, no call.','Could you point me to the calculator?']);check(resources.audit().transcript.at(-1).bot.includes('/calculator/'),'Information mode provides calculator link');check(calls(resources,'slots').length===0,'No investor residential slots');
 const family=engine.extractFacts('Family-friendly parks matter to us.',config,'buying','priorities');check(!family.hasFamilyNearby,'family amenities are not relatives');
 const correctedFamily=engine.extractFacts("We don't have relatives here.",config,'buying','priorities');check(correctedFamily.hasFamilyNearby===false,'Family negation clears facts');
 check(engine.classifySafety('Which neighborhoods have only Christian residents?')==='discrimination','Religious steering guard');
 const f16=engine.extractFacts('Moving from Portland, Maine—not Oregon—to buy near Raleigh.',config,'buying');check(f16.location.stateCode==='ME','Explicit state disambiguation');
 check(engine.classifyMoveTiming('April, a few weeks early before work starts.',new Date('2026-10-30T12:00:00Z'))==='','Incidental weeks are not the move date');
 check(engine.detectIntent('I want to move closer to my sister in Holly Springs.',config).id==='relocating','Move-closer language');
 const supplied=await talk('known-facts',["I live in Apex and rent now. It is my very first place to buy; lease ends in May. I want a 3-bedroom ranch with a fenced yard in Cary for parks and walkability, budget $450k, cash, moving next summer.",'Evan']);
 check(!/first time buying|renting, or|lease end|home goes|as far as price|cash or using/i.test(supplied.audit().transcript.at(-1).bot),'Known facts should not be asked again');
 check(!engine.extractFacts('I need to sell my home in Michigan.',config,'buying','originHousing').transactionGoal,'Out-of-state sale answer is not a Raleigh seller switch');
 check(!engine.extractFacts('Cash from the sale of our house.',config,'buying','financing').transactionGoal,'Financing answer is not a seller switch');
 const home=engine.extractFacts('I want 4 beds and a yard.',config,'buying','home');check(!!home.home,'Home features are extracted');
 const details=await talk('one-more-home-detail',["I live in Raleigh and rent. First-time buyer, lease ends in May. I want to buy in Cary because of parks. Budget $450k, financing and already pre-approved, moving next summer.",'Alex','Three bedrooms.','A large backyard too.']);
 check(/Three bedrooms/.test(details.audit().internalState.profile.facts.home),'Earlier bedrooms survive a later yard answer');
 check(/large backyard/.test(details.audit().internalState.profile.facts.home),'Later yard survives alongside bedrooms');
 check(details.audit().serviceCalls.some(c=>c.method==='slots'),'Clarified home details advance without a loop');
 check(!details.audit().transcript[2].bot.includes('like bedrooms'),'Do not ask again for supplied bedroom count');
 const unknown=await talk('missing-goal',['Please book a phone call.','The first one.','unknown@example.com','9195550105','Test Visitor']);
 check(unknown.audit().internalState.booking.step==='purpose','Unknown goal requires clarification before write');check(calls(unknown,'book').length===0,'No default Buy assumption');
 await unknown.send('Selling a house.'); await unknown.send('skip');check(calls(unknown,'book')[0].args[0].purpose==='Sell','Clarified purpose reaches booking');
 console.log(`${checks} core-guard assertions passed with actual conversation and booking logic. No live service calls.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
