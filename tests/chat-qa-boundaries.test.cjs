// Regression fixtures from the existing QA reports, not another adaptive batch.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {run, engine, config, functions} = require('./chat-batch1-patch.test.cjs');
function realBooking(calls, setup) {
  return scope => {
    vm.runInContext(functions.startBooking, scope);
    scope.loadBookingSlots = () => calls.push('slots'); // The external boundary stays isolated.
    if (setup) setup(scope);
  };
}
function last(result) {
  result.transcript.forEach(turn => assert(!turn.error, `${result.label}: ${turn.error}`));
  return result.transcript.at(-1);
}
for (const text of ['I may not be ready to schedule.','I do not want calls or scheduling.','No call yet, please.','Do not schedule yet.']) {
  assert(engine.declinesScheduling(text), text); assert(!engine.wantsBooking(text), text);
  const calls=[];
  const result=run(text,[`I want to buy in Raleigh, but ${text}`,'No thanks'],realBooking(calls));
  assert(last(result).profile.noScheduling); assert.equal(calls.length,0);
}
for (const text of [
  'My sibling and I inherited a Clayton house and are only gathering information because we cannot agree whether to sell.',
  'What might my North Raleigh house be worth? I am only browsing, not ready to list.',
  'I am just researching Raleigh cap rates and cash flow. No call yet, please.'
]) {
  const calls=[], result=run('Research posture',[text],realBooking(calls)), turn=last(result);
  assert(turn.profile.informationOnly); assert(turn.profile.noScheduling); assert.equal(calls.length,0);
  assert(!turn.bot.some(text=>/Book an investing|exploration call|game plan/.test(text)));
}
const gateCalls=[];
const gate=run('Explicit contact gate',[
  'I have a detailed buying question, but do not collect details unless I confirm.',
  'Please book a phone call.', 'Yes please'
],realBooking(gateCalls));
last(gate); assert(gate.transcript[0].profile.noContact);
assert(!gate.transcript[0].bot.some(text=>/May I have your first name/.test(text)));
assert.equal(gate.transcript[1].profile.pendingContactPermission,'booking');
assert.equal(gateCalls.length,1,'Slots load only after explicit permission');
const declineCalls=[];
const decline=run('Declined contact gate',[
  'I want buying guidance but do not collect details unless I confirm.', 'Please book a phone call.', 'No thanks'
],realBooking(declineCalls));
assert(last(decline).profile.noContact); assert.equal(declineCalls.length,0);
const renter=last(run('Supplied Durham facts',['I rent in Durham and want to buy my first townhouse in Cary next spring.','No thanks']));
assert.match(renter.bot.join(' '),/lease/); assert.equal(renter.profile.facts.currentArea,'Durham');
const investor=last(run('Supplied LTR facts',['I am in Texas, own two LTRs, and want another low-maintenance rental under $400k in Raleigh.','No thanks']));
assert(!investor.bot.some(text=>/first investment|kind of investment|out of state/.test(text)));
assert.equal(investor.profile.originCode,'TX'); assert.match(investor.profile.facts.experience,/two LTRs/);
const chicago=last(run('Supplied Chicago facts',["My partner got a job in RTP, our Chicago lease ends in July, and we want to buy a four-bedroom around $800k near greenways.",'No thanks']));
assert.equal(chicago.profile.originCode,'IL'); assert(chicago.profile.facts.whyRaleigh); assert(chicago.profile.facts.leaseEnd);
const correction=last(run('Corrected origin',['We are moving from Ohio—sorry, I meant Boise, Idaho—to buy near Raleigh.','No thanks']));
assert.equal(correction.profile.originCode,'ID'); assert.equal(correction.profile.originCity,'boise');
const portland=run('Ambiguous origin',['I am moving from Portland to buy in Raleigh.','No thanks','Oregon']);
assert.match(portland.transcript[1].bot.join(' '),/Oregon.*Maine/); assert.equal(last(portland).profile.originCode,'OR');
const sale=last(run('Retain investment sale',[
  'I am a landlord selling a rental house in Garner after ten years, then I may do a 1031 exchange.',
  'No thanks','I live in North Raleigh.','Both the sale and next investment.'
]));
assert.equal(sale.intent,'investing'); assert.equal(sale.profile.facts.currentHome,'Garner');
assert.match(sale.profile.facts.ownedYears,/ten years/); assert(sale.profile.facts.salePriority);
const optedIn=[];
const resumed=last(run('Research visitor changes mind',[
  'I am just researching buying in Raleigh.', 'Can I book a phone call?'
],realBooking(optedIn)));
assert(!resumed.profile.noScheduling); assert.equal(optedIn.length,1);
assert.equal(engine.detectIntent('We might sell a condo, but it belongs to my partner and our main goal is buying near Raleigh after moving from Boston.',config).id,'buying');
assert(engine.declinesScheduling("I'm not ready to talk to the team."));
console.log('Reported QA regressions pass with the real booking-entry guard: negative/conditional requests, consent gate, research-only replies, supplied facts, corrected/ambiguous origins, and investment-sale context. No live requests.');
