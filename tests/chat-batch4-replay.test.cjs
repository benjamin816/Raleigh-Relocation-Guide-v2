// Frozen-input replay verifies runtime/output regressions, not a new adaptive quality score.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fixtures=require('./fixtures/chat-batch4-frozen-turns.json');
const {createSession}=require('./helpers/chat-isolated.cjs');
(async()=>{
 const audits=[];assert.equal(fixtures.length,50);
 for(const f of fixtures){const s=createSession(f.id);for(const text of f.turns){if(s.audit().internalState.ended)break;const response=await s.send(text);assert(response.botMessage,f.id+': unexpected blank reply');}const a=s.audit();assert.equal(a.blockedAttempts.length,0,f.id);audits.push(a);}
 const out=path.resolve(__dirname,'../output/chat-batch4-fix');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'frozen-replay.json'),JSON.stringify(audits,null,2));
 console.log(`Replayed all 50 frozen Batch 4 input sequences: no runtime errors, no blank replies before a terminal exit, no unmocked external calls. ${audits.filter(a=>a.serviceCalls.some(c=>c.method==='book')).length} mocked confirmations. This is not an independent conversational-quality rescore.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
