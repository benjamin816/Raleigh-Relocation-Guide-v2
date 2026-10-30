const assert=require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
const engine=require('../assets/js/raleigh-chat-engine.js');
const fs=require('node:fs'),vm=require('node:vm');const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('assets/js/raleigh-chat-config.js','utf8'),sandbox);const config=sandbox.window.RaleighChatConfig;
async function ready(id){const s=createSession(id);for(const t of ["I live in Raleigh and rent month-to-month. First-time buyer. I want to buy in Cary because of parks. I want 3 beds and 2 baths. Budget $600k.",'Ben','Month to month'])await s.send(t);return s;}
(async()=>{
 const s=await ready('uncertain-funding-and-timing');
 let reply=(await s.send('Not sure')).botMessage;
 assert.match(reply,/could lean either way/);assert.match(reply,/Last question real quick/i);assert.doesNotMatch(reply,/Great!/);assert.equal(s.audit().serviceCalls.length,0);
 reply=(await s.send('Not sure, just started looking')).botMessage;
 assert.match(reply,/exploration phase/);assert.match(reply,/this year or next/);assert.equal(s.audit().serviceCalls.length,0,'No slots before the follow-up answer');
 reply=(await s.send('Still not sure')).botMessage;
 assert.match(reply,/burning questions/);assert.match(reply,/research phase/);assert.match(reply,/Which time works/);assert.doesNotMatch(reply,/do not need to plan a new purchase/i);assert.equal(s.audit().serviceCalls.filter(c=>c.method==='slots').length,1);
 for(const timing of ['A few years away','Far out, probably two years']){const far=await ready(timing);await far.send('Cash');reply=(await far.send(timing)).botMessage;assert.match(reply,/research phase/);assert.equal(far.audit().serviceCalls.filter(c=>c.method==='slots').length,1);}
 const dated=await ready('year-follow-up');await dated.send('Cash');await dated.send('Not sure');reply=(await dated.send('Next summer')).botMessage;assert.match(reply,/most options on the buy side/);assert.doesNotMatch(reply,/still figuring out the timing/);
 const facts=engine.extractFacts('I own a house in Idaho that I need to sell.',config,'buying','originHousing');assert.notEqual(facts.saleOnly,true,'An origin-home sale is not a sale-only goal');
 const changed=engine.extractFacts('Actually I only want to buy a home now.',config,'selling','timing');assert.equal(changed.saleOnly,false,'Explicit buyer correction clears a stale sale-only flag');
 console.log('Uncertain funding, two-stage timeline, distant timing, concrete follow-up and origin-sale regressions passed. Mock availability only; no bookings.');
})().catch(e=>{console.error(e);process.exitCode=1;});
