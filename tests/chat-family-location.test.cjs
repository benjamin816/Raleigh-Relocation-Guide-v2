const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createSession}=require('./helpers/chat-isolated.cjs');
const engine=require('../assets/js/raleigh-chat-engine.js');
const cfg={window:{}};vm.runInNewContext(fs.readFileSync('assets/js/raleigh-chat-config.js','utf8'),cfg);const config=cfg.window.RaleighChatConfig;
(async()=>{
 for(const area of ['Cary','Apex','North Raleigh']){
  const s=createSession('family-'+area);
  for(const t of ['Moving to Raleigh.','Ben','Boise','Family'])await s.send(t);
  assert.match(s.audit().transcript.at(-1).bot,/What part.*family/);
  const reply=(await s.send(area)).botMessage;
  assert.match(reply,/great area/);assert.doesNotMatch(reply,/What part.*family/);assert.match(reply,/home in Idaho/);
  assert.equal(s.audit().internalState.profile.facts.familyArea,area);
  assert.equal(s.audit().internalState.profile.originCode,'ID','Family address must not make visitor local');
  await s.send('We have a house to sell.');assert.doesNotMatch(s.audit().transcript.at(-1).bot,/What part.*family/);
 }
 for(const answer of ["I don't know",'Not sure']){
  const s=createSession('unknown-family');for(const t of ['Moving to Raleigh.','Ben','Boise','Family'])await s.send(t);
  const reply=(await s.send(answer)).botMessage;assert.doesNotMatch(reply,/great area|What part.*family/);assert.match(reply,/home in Idaho/);assert.equal(s.audit().internalState.profile.facts.familyArea,'');
 }
 for(const key of ['familyNearby','priorityFamilyArea']){const facts=engine.extractFacts('Cary',config,'relocating',key);assert.equal(facts.familyArea,'Cary');assert.equal(facts.familyNearbyAnswered,true);}
 const source=fs.readFileSync('assets/js/raleigh-chat.js','utf8');const fn=source.slice(source.indexOf('  function applyKnownFacts('),source.indexOf('  function markPreapproval('));
 const state={intent:'relocating',profile:{facts:{familyNearby:'Cary'},familyArea:'Cary',familyAreaAsked:true}};vm.runInNewContext(fn+'\napplyKnownFacts();',{state,engine,config});assert.equal(state.profile.facts.familyArea,'Cary','Existing saved chats are repaired');
 console.log('Boise → family → location advances once; unknown locations and both family question aliases advance; older saved family answers repaired. No live calls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
