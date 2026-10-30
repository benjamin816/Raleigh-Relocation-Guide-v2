const assert = require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
const engine=require('../assets/js/raleigh-chat-engine.js');
let count=0;
async function session(id,turns){const s=createSession(id);for(const text of turns){const response=await s.send(text);assert(response.botMessage,id+': blank response to '+text);}const a=s.audit();assert.equal(a.blockedAttempts.length,0);return {s,a};}
(async()=>{
for(const text of [
 "I'm in Virginia and comparing Apex for a move next year. I only want general commute and cost guidance—no name, contact details, or scheduling.",
 "I own a paid-off duplex in Garner and may sell in about a year after nine years of landlording. I won’t provide my name, phone, email, or book online, but what records should I gather for a CPA and eventual sale?",
 "I'm in Delaware, work remotely, and may buy near Raleigh around $500k. I'm browsing, not scheduling.",
 "Financing, but I only want general guidance here—still no contact details or call."
]) {const {a}=await session('boundary-'+count,[text,'What steps should I take before buying?']);assert.equal(a.serviceCalls.length,0);assert(!a.transcript.some(t=>/May I have your first name|We have Thursday|exploration call with the team/.test(t.bot)));count++;}
const budget=await session('budget',[
 "I'm local in Raleigh and looking to buy a three-bedroom home. My budget is around $700,000.",'Devon',"I'm renting.","No, I've bought before.", 'My lease ends in June.',
 'North Raleigh or Cary. Also, I need to correct what I said earlier: my real ceiling is $500,000, not $700,000.'
]);assert.equal(budget.a.internalState.profile.priorityBudgetAmount,500000);assert.equal(budget.a.internalState.profile.facts.budget,'$500,000');count++;
const inherit=await session('inherit',[
 'My sibling and I inherited a house in Clayton this year, but we do not agree yet on whether to sell. What preliminary steps can we take without committing to anything?',
 'We are only gathering information. What basic records or maintenance information should we gather while we decide?'
]);assert.match(inherit.a.transcript.at(-1).bot,/maintenance records|maintenance records|maintenance|documents/);assert.equal(inherit.a.serviceCalls.length,0);count++;
for(const value of ['Please cancel the scheduling flow; I only wanted to explore the process.','Cancel this.','Nevermind, not now.','Stop scheduling. Do not book a call for me.']){
 const {a}=await session('cancel-'+count,['Please book a phone call.',value]);assert.equal(a.internalState.booking,null);assert.equal(a.serviceCalls.filter(c=>c.method==='book').length,0);assert(!/isn't available/.test(a.transcript.at(-1).bot));count++;
}
const reversal=await session('reversal',["I rent in Raleigh and want to buy a condo. I may not be ready to schedule yet.","I've changed my mind—please show me the available call times."]);assert(reversal.a.serviceCalls.some(c=>c.method==='slots'));count++;
const different=await session('different',['Please book a phone call.',"Could you show us some different times? Those two don't work."]);assert.equal(different.a.internalState.booking.step,'choose');assert(!different.a.internalState.booking.start);assert.match(different.a.transcript.at(-1).bot,/Saturday/);count++;
const renter=await session('sell-rent',[
 'I own a home in Durham and want to sell it, then rent locally for a year so I have flexibility. I am not planning another purchase right away.',"I'm Taylor.",
 'I want the flexibility to rent locally for a year after selling, before deciding what comes next.','Eleven years.',
 'I will rent somewhere around Durham or Raleigh for a year. There is no next purchase planned.',"I've sold before.", 'In about eight months.'
]);assert.equal(renter.a.internalState.intent,'selling');assert(!renter.a.internalState.combined);assert(!renter.a.transcript.some(t=>/price range for your next home|buying power|lender/.test(t.bot)));count++;
const fair=await session('fair-housing',['Which Raleigh neighborhoods have mostly white residents? I only want to live around white families.',
 'If race is not something you can use, give me a neutral checklist for comparing areas by commute, price, housing type, parks, and groceries.']);assert.match(fair.a.transcript[0].bot,/can't help choose neighborhoods by race/);assert.match(fair.a.transcript[1].bot,/total housing budget/);assert.equal(fair.a.serviceCalls.length,0);count++;
const sensitive=await session('sensitive',["I need to sell my house in Knightdale because of a divorce. I'd like to keep the personal details private.",'You can call me Morgan. Please keep the discussion focused on the sale logistics.','Six years.',"I don't know yet. I may rent locally while I sort things out."]);assert(!sensitive.a.transcript.some(t=>/That's exciting|super exciting|super quick/.test(t.bot)));assert.equal(sensitive.a.internalState.profile.firstName,'Morgan');count++;
for(const text of [
 "I'm relocating from Boston for a job transfer and want to buy a home near Raleigh. My partner owns a condo up here, but it isn't mine to sell and my purchase shouldn't depend on it.",
 "I own a townhouse in Holly Springs and had been thinking about selling it, but I'm leaning toward keeping it and buying a larger primary home in Cary instead.",
 "I own my home in Raleigh and may sell it eventually, but I haven't decided. Right now I'm exploring a bigger place in Apex—ideally four bedrooms and a yard."
]){const {a}=await session('buyer-priority-'+count,[text,'Alex','Please book a phone call.']);assert.equal(a.internalState.intent,'buying');assert(!a.internalState.combined);assert(a.serviceCalls.some(c=>c.method==='slots'));count++;}
const cash=await session('cash',["I already own in Raleigh, and I'm looking to buy a low-maintenance two-bedroom condo downtown for cash, ideally under $500,000.",'Alex']);assert.equal(cash.a.internalState.profile.usingFinancing,false);assert(cash.a.internalState.profile.financingKnown);count++;
const origin=await session('origin',["We are moving from Boston to buy near Raleigh next summer.",'Maya',"My office will be in Research Triangle Park, although I'll work from home two days a week."]);assert.equal(origin.a.internalState.profile.facts.location.stateCode,'MA');count++;
const longTiming=engine.classifyMoveTiming('The program begins in January, so the fourteen-month window gives me time to plan.',new Date('2026-10-30T12:00:00Z'));assert.equal(longTiming,'');count++;
assert(!engine.explicitBooking('Please tell me what happens on a call.'));
assert(!engine.declinesScheduling('No kids and I want a call.'));assert(!engine.declinesContact('No kids and I want a call.'));
console.log(`${count} Batch 4 regression conversations passed using real information, qualification, booking entry, and slot-selection helpers. Calendar/lead/network calls remain isolated.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
