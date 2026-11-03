const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const sent=[];
const ctx=vm.createContext({console,Date,GmailApp:{getAliases:()=>[],sendEmail:(...args)=>sent.push(args)},Utilities:{formatDate:()=> 'Fixture time'},Session:{getScriptTimeZone:()=> 'America/New_York'}});
vm.runInContext(fs.readFileSync(path.join(root,'scripts/google-apps-script/website-to-sheet-apps-script.txt'),'utf8'),ctx);
const base={first_name:'Fixture',last_name:'Person',email:'fixture@example.invalid',phone:'9195550100',submitted_at:'2026-11-03T14:00:00Z'};
const fixtures=[
 ['buyer-page',{lead_type:'buyer',source_page:'https://raleighncguide.com/buy/'},'Buyer consultation pop-up — Buyer resources page'],
 ['home-buyer',{lead_type:'buyer',source_page:'https://raleighncguide.com/'},'Buyer consultation pop-up — Home page'],
 ['seller',{lead_type:'seller',source_page:'/sell/'},'Seller consultation pop-up — Seller resources page'],
 ['home-valuation',{lead_type:'home_eval',source_page:'/sell/'},'Home valuation request form — Seller resources page'],
 ['guide',{lead_type:'relo_guide',source_page:'/2026/',source_key:'relo_guide_direct_from_website'},'2026 Raleigh Relocation Guide download'],
 ['call-me',{lead_type:'requested_contact',source_page:'/',requested_contact_source:'home_call_me_popup'},'Call me contact pop-up — Home page'],
 ['new-construction',{lead_type:'new_construction',source_page:'/raleighs-hottest-deals/builders/',requested_contact_source:'new_construction_page_form'},'New construction inquiry form — /raleighs-hottest-deals/builders/'],
 ['chat',{lead_type:'requested_contact',source_key:'website_rule_chat',source_page:'/buy/'},'Website chat contact form — Buyer resources page'],
 ['chat-upload',{lead_type:'requested_contact',source_key:'website_rule_chat',requested_contact_source:'Chat pre-approval for booked exploration call'},'Website chat — optional pre-approval upload'],
 ['calculator',{lead_type:'calculator',source_page:'/calculator/'},'Investment calculator contact capture — /calculator/'],
 ['calculator-message',{lead_type:'calculator',source_key:'calculator_message',source_page:'/calculator/'},'Investment calculator inquiry form — /calculator/'],
 ['suburb-quiz',{source:'/quiz/',results:[{suburb:'Cary'},{suburb:'Apex'}],wantsConsultation:true},'Raleigh Suburb Quiz — results request',true],
 ['neighborhood-quiz',{lead_type:'neighborhood_quiz',quiz_type:'neighborhood_fit',quiz_title:'Cary Neighborhood Fit',quiz_city:'Cary',source_page:'/explore-the-area/cary/',results:[{neighborhood:'Amberly'}]},'Cary Neighborhood Fit — results request',true],
 ['stored-quiz',{lead_type:'suburb_quiz',source_page:'/quiz/',quiz_results_json:'[{"suburb":"Wake Forest"}]',quiz_answers_json:'[{"q":"one","a":"A"}]'},'Raleigh Suburb Quiz — results request',true],
 ['legacy-picks',{lead_type:'suburb_quiz',source_page:'/quiz/',quiz_top_pick:'Cary'},'Raleigh Suburb Quiz — results request',true],
 ['quiz-empty',{lead_type:'suburb_quiz',source_page:'/quiz/',results:null,quiz_top_pick:'null'},'Raleigh Suburb Quiz — results request'],
 ['buyer-on-quiz-page',{lead_type:'buyer',source_page:'/quiz/',quiz_results_json:'null'},'Buyer consultation pop-up — /quiz/'],
];
const rendered=[];
for(const [id,payload,label,isQuiz] of fixtures){
 const lead=ctx.normalizeLead_({...base,...payload});
 ctx.sendLeadEmail_(lead,payload);
 const [to,subject,body,options]=sent.at(-1);
 assert.equal(to,'livinginraleighteam@gmail.com');
 assert.equal(body.split('\n')[0],'SOURCE FORM: '+label,id);
 assert(options.htmlBody.includes('<h1 style="font-size:22px;margin:8px 0 0">'+label+'</h1>'),id+' prominent heading');
 assert(options.htmlBody.indexOf(label)<options.htmlBody.indexOf('New website lead received.'),id);
 assert(!options.cc&&!options.bcc,id+' recipient unchanged');
 if(!isQuiz){assert(!/Raleigh (?:Suburb|Neighborhood) Quiz Results|Requested Team Call: No|Missing quiz top pick/.test(body),id+' no spurious quiz');}
 else {assert(/Quiz Results/.test(body),id+' meaningful quiz section');assert(lead.quiz_top_pick,id+' parsed top pick');}
 rendered.push({id,label,subject,body,html:options.htmlBody});
}
for(const value of [undefined,null,'null','undefined','','[]','{}','NULL',[],{},'"null"']){
 assert.equal(ctx.safeJsonString_(value),'','absent JSON '+String(value));
 const lead=ctx.normalizeLead_({...base,lead_type:'buyer',source_page:'/buy/',results:value,answers:value,quiz_results_json:value});
 assert.equal(lead.lead_type,'buyer');assert.equal(lead.quiz_results_json,'');
 ctx.sendLeadEmail_(lead,{});assert(!/Quiz Results|Requested Team Call: No/.test(sent.at(-1)[2]));
}
assert.equal(ctx.normalizeLead_({...base,lead_type:'buyer',quiz_title:'Stale quiz title',results:[{suburb:'Cary'}]}).lead_type,'buyer');
assert.equal(ctx.isQuizSubmission_({source_page:'/buy/?next=/quiz/'}),false,'Query is not a source identity');
assert.equal(ctx.isQuizSubmission_({source_page:'/learning-center/blog/quiz-tips/'}),false);
// Exercise the actual pending-email scan with in-memory sheet rows. No Gmail/Sheet/network writes.
const marks=[],quizSent=[];
const quizCtx=vm.createContext({console,Date,SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},MailApp:{sendEmail:()=>{throw Error('Unexpected real send path');}}});
vm.runInContext(fs.readFileSync(path.join(root,'scripts/google-apps-script/suburb-hood-quiz-results-email-apps-script.txt'),'utf8'),quizCtx);
const headers=['First Name','Last Name','Email','Source Page','Source Key','Lead Type','Quiz Type','Quiz Title','Quiz City','Quiz Slug','Quiz Top Pick','Quiz Second Pick','Quiz Third Pick','Quiz Results JSON','Quiz Answers JSON','Quiz Result Email Status','Quiz Result Email Sent At','Quiz Result Email Error'];
const row=(o)=>headers.map(h=>o[h]??'');
const rows=[
 row({'Email':'buyer@example.invalid','Lead Type':'buyer','Source Page':'/buy/','Quiz Results JSON':'null'}),
 row({'Email':'guide@example.invalid','Lead Type':'relo_guide','Source Page':'/2026/','Quiz Results JSON':'null'}),
 row({'Email':'contact@example.invalid','Lead Type':'requested_contact','Source Page':'/quiz/','Quiz Results JSON':'null'}),
 row({'Email':'empty@example.invalid','Source Page':'/buy/','Quiz Results JSON':'[]','Quiz Title':'null'}),
 row({'Email':'quiz@example.invalid','Lead Type':'suburb_quiz','Source Page':'/quiz/','Quiz Top Pick':'Cary'}),
 row({'Email':'neighborhood@example.invalid','Lead Type':'neighborhood_quiz','Quiz Type':'neighborhood_fit','Quiz Results JSON':'[{"suburb":"Amberly"}]'}),
 row({'Email':'missing@example.invalid','Lead Type':'suburb_quiz','Source Page':'/quiz/','Quiz Results JSON':'null'}),
 row({'Email':'sent@example.invalid','Lead Type':'suburb_quiz','Quiz Top Pick':'Apex','Quiz Result Email Status':'sent'}),
];
const sheet={getLastRow:()=>rows.length+1,getLastColumn:()=>headers.length,getRange:(r,c,n,m)=>({getValues:()=>r===1?[headers]:rows,setValue:v=>marks.push({row:r,col:c,value:v})})};
quizCtx.sendSuburbResultsEmail_=p=>{if(!quizCtx.quizText_(p.quiz_top_pick))throw Error('Missing quiz top pick.');quizSent.push(p.email);};
quizCtx.sendNeighborhoodResultsEmail_=p=>quizSent.push(p.email);
const result=quizCtx.sendPendingSuburbQuizEmails();
assert.equal(result.scanned,8);assert.equal(result.matched,3);assert.equal(result.sent,2);assert.equal(result.failed,1);
assert(marks.every(x=>[6,7,8].includes(x.row)),'Only actual quiz rows may receive quiz-email status');
assert.equal(quizSent.join(','),'quiz@example.invalid,neighborhood@example.invalid');
// Attachment and alias behavior remain intact; HTML escapes untrusted source text.
const attachment={fixture:true};ctx.sendLeadEmail_(ctx.normalizeLead_({...base,lead_type:'requested_contact',requested_contact_source:'<script>unsafe</script>'}),{},attachment);
assert.equal(sent.at(-1)[3].attachments[0],attachment);assert(!sent.at(-1)[3].htmlBody.includes('<script>'));
ctx.GmailApp.getAliases=()=>['benjamin.carver@exprealty.com'];ctx.sendLeadEmail_(ctx.normalizeLead_({...base,lead_type:'buyer',source_page:'/buy/'}),{});assert.equal(sent.at(-1)[3].from,'benjamin.carver@exprealty.com');
if(process.env.LEAD_EMAIL_RENDER_FIXTURES==='1'){
 const out=path.join(root,'output/admin-lead-email-source-review');fs.mkdirSync(out,{recursive:true});
 for(const f of rendered){fs.writeFileSync(path.join(out,f.id+'.html'),'<!doctype html><meta charset="utf-8"><title>'+f.id+'</title>'+f.html);}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({fixtures:rendered.map(({html,...f})=>f),scan:{...result},realEmailsSent:0},null,2));
}
console.log('17 admin email source fixtures; null/legacy input guards; actual quiz worker scan; recipient/attachment/escaping checks passed. All external services mocked.');
