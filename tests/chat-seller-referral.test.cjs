const assert=require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
async function talk(id,turns,metadata){const s=createSession(id,metadata);for(const turn of turns){const r=await s.send(turn);assert(r.botMessage,'No blank replies');}assert.equal(s.audit().blockedAttempts.length,0);return s;}
const pitch="I'm moving from Idaho, need to sell my home there, and only plan to rent in Raleigh.";
(async()=>{
 const s=await talk('referral-single',[pitch,'12 months']);
 assert.match(s.audit().transcript[0].bot,/few months.*12-plus months/);assert.equal(s.audit().serviceCalls.filter(c=>c.method==='slots').length,1);
 assert.match(s.audit().transcript[1].bot,/trusted listing agents/);assert.match(s.audit().transcript[1].bot,/10–15-minute phone call/);assert.match(s.audit().transcript[1].bot,/learning-center/);assert.equal(s.audit().internalState.booking.details.callType,'phone');
 for(const t of ['The first one.','referral@example.com','9195550101','Taylor Reed','Our home is in Boise.'])await s.send(t);
 const bookings=s.audit().serviceCalls.filter(c=>c.method==='book');assert.equal(bookings.length,1);const payload=bookings[0].args[0];assert.equal(payload.purpose,'Sell');assert.equal(payload.durationMinutes,15);assert.equal(payload.appointmentType,'seller_referral');assert.equal(payload.callType,'phone');assert.match(payload.notes,/listing-agent referral/);assert.match(payload.notes,/Boise/);assert.match(s.audit().transcript.at(-1).bot,/15-minute phone call/);
 const split=await talk('split-referral',["I'm moving from Idaho to Raleigh.",'Ben','To be closer to family.','We need to sell our home in Idaho.','We will only be renting in Raleigh.','12 months']);assert.equal(split.audit().internalState.profile.outOfStateReferral,true);
 for(const [id,first] of [['no-sale',"I'm moving from Idaho and only looking to rent. No house to sell."],['local-sale',"I live in Cary and want to sell my home and rent next."],['bridge-buy',"I'm moving from Idaho, selling my home there, renting for two months, then buying a home in Cary."],['local-property',"I'm moving from Idaho but selling my house in Cary and only planning to rent here."],['no-sale-again',"I'm moving from Idaho and want to rent in Raleigh. I don't have a house to sell."]]){
 const normal=await talk(id,[first]);assert.notEqual(normal.audit().internalState.profile.outOfStateReferral,true,id);assert.equal(normal.audit().serviceCalls.length,0,id+' must not start referral booking');}
 const decline=await talk('referral-no-call',[pitch,'No thanks, I do not want to book a call.']);assert.equal(decline.audit().internalState.booking,null);assert.equal(decline.audit().serviceCalls.filter(c=>c.method==='book').length,0);
 const legacy=await talk('legacy-service',[pitch,'12 months','The first one.','old@example.com','9195550103','Test Person','skip'],{legacyBookingService:true});assert.equal(legacy.audit().serviceCalls.filter(c=>c.method==='book').length,0,'Never silently book 60 minutes on old service');assert.match(legacy.audit().transcript.at(-1).bot,/No appointment has been booked/);
 console.log('Out-of-state seller/renter referral routing, phone booking payload, exclusions, refusal and old-service protection passed. All service calls mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
