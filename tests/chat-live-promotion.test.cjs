const assert=require('node:assert/strict');
const {createSession}=require('./helpers/chat-isolated.cjs');
const api=require('../assets/js/raleigh-chat-understanding.js'),engine=require('../assets/js/raleigh-chat-engine.js');
(async()=>{
 const seed=["I'm buying a home in Apex, moving from Minnesota.",'Ben','Warmer weather.','We have a home to sell.'];
 for(const text of ['honestly no clue yet','Honestly, no clue yet.',"I'm not really sure yet"]){
  const s=createSession('uncertain-area');for(const t of seed)await s.send(t);
  const r=(await s.send(text)).botMessage;
  assert.match(r,/Totally get it - how about things like/);assert.doesNotMatch(r,/stood out/);assert.equal(s.audit().internalState.profile.currentQuestionKey,'priorityMore');
 }
 const s=createSession('phone-weekend');
 const raw='Can I line up a phone chat with Ricardo?';
 const canonical=api.canonical({kind:'human',certain:true,canonical:'Can I speak with Ricardo?'},raw,{},engine);
 await s.send(raw,{canonical,kind:'human'});
 assert.equal(s.audit().internalState.booking.details.callType,'phone');
 let r=(await s.send('Could we make it on a weekend around lunchtime?')).botMessage;
 assert.match(r,/Saturday|Sunday/);assert.doesNotMatch(r,/many questions|Thursday|Friday/);
 assert.equal(s.audit().internalState.booking.preference.daypart,'midday');
 assert.equal(s.audit().internalState.booking.preference.host,'Ricardo');
 r=(await s.send('The first one works')).botMessage;
 assert.match(r,/email/);assert.doesNotMatch(r,/prefer a video|rather.*phone/);
 assert.equal(s.audit().internalState.booking.details.callType,'phone');
 assert.equal(s.audit().serviceCalls.some(c=>c.method==='book'),false);
 console.log('Promotion fixes: uncertainty, weekend midday filtering and retained phone/Ricardo preference passed. No live writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
