const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('../assets/js/raleigh-chat-engine.js');const {createSession}=require('./helpers/chat-isolated.cjs');
const box={window:{}};vm.runInNewContext(fs.readFileSync('assets/js/raleigh-chat-config.js','utf8'),box);const config=box.window.RaleighChatConfig;
(async()=>{
 for(const relative of ['My mother in law lives in Cary and is terminally ill.','My parents live in Cary.','Our family lives in Apex.','My sister is living in Raleigh.']){
  const facts=engine.extractFacts(relative,config,'relocating','whyRaleigh');assert.notEqual(facts.location?.type,'local',relative);
  const s=createSession(relative);for(const t of ['Moving from Idaho','Alex',relative])await s.send(t);assert.equal(s.audit().internalState.profile.originCode,'ID');
 }
 assert.equal(engine.extractFacts('My parents live in Cary, but I live in Apex.',config,'buying','whyRaleigh').currentArea,'Apex');
 for(const condition of ['unwell','sick','ill','health problems','health issues','cancer','terminally ill','dying']){
  const s=createSession(condition);for(const t of ['Moving from Idaho','Alex','My mother lives in Cary and is '+condition+'.'])await s.send(t);
  assert.match(s.audit().transcript.at(-1).bot,/so sorry to hear that/);assert.equal(s.audit().internalState.profile.originCode,'ID');
 }
 const s=createSession('changed-rental-plan');await s.send('I only want to rent in Raleigh');await s.send('12 months');assert.equal(s.audit().internalState.profile.rentalOnly,true);
 await s.send('Actually, I want to buy in Raleigh instead.');assert.equal(s.audit().internalState.profile.rentalOnly,false);assert.equal(s.audit().internalState.profile.pendingRentalPlan,false);
 console.log('Relative residence, illness wording and explicit rental-to-purchase corrections passed without live operations.');
})().catch(e=>{console.error(e);process.exitCode=1});
