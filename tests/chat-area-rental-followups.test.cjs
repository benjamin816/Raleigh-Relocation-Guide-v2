const assert=require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
(async()=>{
 const s=createSession('area-schools-commute');
 for(const t of ["I'm buying a home, moving from Minnesota.",'Ben','Warmer weather.'])await s.send(t);
 assert.match(s.audit().transcript.at(-1).bot,/area you choose to live in/);
 let r=(await s.send('Schools.')).botMessage;
 assert.match(r,/Wake County schools!/);assert.doesNotMatch(r,/like[^?]*schools/i);
 r=(await s.send('Commute.')).botMessage;assert.match(r,/commuting to/);
 r=(await s.send('RTP')).botMessage;assert.match(r,/Research Triangle Park/);assert.match(r,/30 minutes/);assert.match(r,/shorter.*longer/);
 const home=createSession('two-home-features');
 for(const t of ["I live in Raleigh and rent. First-time buyer, lease ends in May. I want to buy in Cary because of parks. Budget $450k, cash, moving next summer.",'Ben'])await home.send(t);
 r=(await home.send('4 beds, 2 baths')).botMessage;assert.match(r,/anything else/);assert.doesNotMatch(r,/like[^?]*(?:bedrooms|bathrooms)/);assert.match(r,/square footage|yard/);
 await home.send('A big yard too.');assert(home.audit().serviceCalls.some(c=>c.method==='slots'));
 const rental="I'm moving from Boise, need to sell my home there, and will rent in Raleigh.";
 for(const [answer,referral,minutes] of [['3 months',false,60],['6 to 12 months',true,15]]){
  const x=createSession(answer);r=(await x.send(rental)).botMessage;assert.match(r,/few months.*12-plus months/);assert.equal(x.audit().serviceCalls.length,0,'Must ask qualifier before slots');assert.doesNotMatch(r,/MLS|listing agent/);
  r=(await x.send(answer)).botMessage;assert.equal(!!x.audit().internalState.profile.outOfStateReferral,referral);if(referral){assert.match(r,/in Boise/);assert.match(r,/10–15-minute/);}else assert.match(r,/permanent home/);
  for(const t of ['The first one.','test@example.com','9195550100','Test Person','skip'])await x.send(t);
  const booking=x.audit().serviceCalls.find(c=>c.method==='book');assert.equal(booking.args[0].durationMinutes,minutes);
 }
 const undecided=createSession('unsure-rental');await undecided.send(rental);r=(await undecided.send('Not sure yet')).botMessage;assert.match(r,/three months or less/);assert.equal(undecided.audit().serviceCalls.length,0);
 for(const q of ['Do you work with renters?','Can you help me find a rental?','Do you do rentals?']){const x=createSession(q);r=(await x.send(q)).botMessage;assert.match(r,/MLS/);assert.match(r,/12-plus months/);assert.equal(x.audit().serviceCalls.length,0);}
 const ack=home.audit().transcript.map(t=>t.bot.match(/^(Got it\.|Understood\.|Okay\.)/)?.[0]).filter(Boolean);for(let i=1;i<ack.length;i++)assert.notEqual(ack[i],ack[i-1]);
 console.log('Area wording, schools, RTP, two-feature follow-up, rental horizons, market-specific referrals and renter-service questions passed. No live operations.');
})().catch(e=>{console.error(e);process.exitCode=1;});
