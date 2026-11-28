const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../scripts/google-apps-script/website-to-sheet-apps-script.txt'),'utf8');
const base={firstName:'Fixture',lastName:'One',email:'quiz@example.invalid',phone:'9195550101',results:[{suburb:'Cary'}]};
const cases=[
 ['suburb results only',{source:'/quiz/',wantsConsultation:false,quiz_callback_requested:false},false],
 ['neighborhood results only',{lead_type:'neighborhood_quiz',source_page:'/explore-the-area/cary/',quiz_callback_requested:false},false],
 ['legacy automatic flag',{source:'/quiz/',wantsConsultation:true},false],
 ['not a genuine checked value',{source:'/quiz/',wantsConsultation:true,quiz_callback_requested:'true'},false],
 ['suburb requested a call',{source:'/quiz/',wantsConsultation:true,quiz_callback_requested:true},true],
 ['neighborhood requested a call',{lead_type:'neighborhood_quiz',source_page:'/explore-the-area/cary/',quiz_callback_requested:true},true],
 ['ordinary buyer unchanged',{lead_type:'buyer',source_page:'/buy/'},true]
];
for(const [name,fixture,alert] of cases)test(name,()=>{
 const appended=[], emails=[], statuses=[];
 const sheet={};
 const ctx=vm.createContext({
  Date,LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  SpreadsheetApp:{openById:()=>({})},
  GmailApp:{getAliases:()=>[],sendEmail:(...args)=>emails.push(args)},
  Session:{getScriptTimeZone:()=> 'America/New_York'},Utilities:{formatDate:()=> 'Fixture time'}
 });
 vm.runInContext(script,ctx);
 ctx.getOrCreateSheet_=()=>sheet; ctx.ensureHeaders_=()=>{};ctx.json_=x=>x;
 ctx.appendLead_=(_s,lead,raw)=>{appended.push({lead,raw});return 2;};
 ctx.updateLeadEmailStatus_=(_s,_r,status)=>statuses.push(status);
 const payload={...base,...fixture};
 const result=ctx.doPost({postData:{contents:JSON.stringify(payload)}});
 assert.equal(result.ok,true,result.error);
 assert.equal(appended.length,1,'CRM sheet append remains unconditional');
 assert.equal(emails.length,Number(alert));
 assert.equal(statuses[0],alert?'sent':'skipped_quiz_results_only');
 if(fixture.lead_type!=='buyer'){
  assert.equal(appended[0].lead.wants_consultation,alert);
  assert.ok(appended[0].lead.quiz_top_pick,'results preserved for separate mailer');
  if(alert)assert.equal((emails[0][2].match(/Requested Team Call: Yes/g)||[]).length,1);
 }
});
