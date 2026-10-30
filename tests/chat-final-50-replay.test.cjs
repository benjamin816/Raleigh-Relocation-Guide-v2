// Replay of reported failures, not a fresh adaptive generation or quality rescore.
const assert=require('node:assert/strict'),fs=require('node:fs');
const engine=require('../assets/js/raleigh-chat-engine.js');
const {createSession}=require('./helpers/chat-isolated.cjs');const fixtures=require('./fixtures/chat-final-50-frozen-turns.json');
(async()=>{const audits=[];for(const f of fixtures){const s=createSession(f.id);for(const text of f.turns){if(s.audit().internalState.ended)break;const before=s.audit().serviceCalls.length;let r=await s.send(text);if(engine.declinesScheduling(text)){assert.equal(s.audit().serviceCalls.length,before,f.id+': refusal cannot query or book');assert.equal(s.audit().internalState.booking,null,f.id+': refusal clears draft booking');}assert(r.botMessage,f.id+': blank reply');}const a=s.audit();assert.equal(a.blockedAttempts.length,0);audits.push(a);}
const by=id=>audits.find(a=>a.sessionId===id);assert.equal(by('F03').internalState.profile.priorityBudgetAmount,460000);
assert.equal(by('F43').serviceCalls.find(c=>c.method==='book').args[0].purpose,'Buy');
assert.equal(by('F07').serviceCalls.filter(c=>c.method==='slots').length,1,'Host note cannot restart slots');
assert.equal(by('F44').serviceCalls.filter(c=>c.method==='book').length,1,'Sale-only notes complete, not reopen qualification');
assert.equal(by('F10').serviceCalls.length,0,'Stop request prevents auto scheduling');
for(const id of ['F16','F17'])assert.equal(by(id).serviceCalls.filter(c=>c.method==='suggest').length,0,'Unknown and pause replies cannot query a time');
assert(by('F50').transcript.some(t=>t.bot.includes('/calculator/')));
fs.mkdirSync('output/chat-core-patch',{recursive:true});fs.writeFileSync('output/chat-core-patch/final-50-replay.json',JSON.stringify(audits,null,2));
console.log('50 reported input sequences replayed without runtime errors, blank replies, or live operations; all eight explicit critical-receipt assertions passed. No new quality score claimed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
