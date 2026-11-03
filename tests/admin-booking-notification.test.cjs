const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');let mails=[];
const ctx=vm.createContext({console,MailApp:{sendEmail:x=>mails.push(x)},Utilities:{formatDate:()=> 'fixture'}});
vm.runInContext(fs.readFileSync('scripts/google-apps-script/calendar-round-robin/Code.gs','utf8'),ctx);
const event=(desc,tag='')=>({getDescription:()=>desc,getTag:()=>tag,getStartTime:()=>new Date(),getEndTime:()=>new Date()});
assert.equal(ctx.rrNotify_(event('','admin'),{name:'Benjamin'},'link','reason'),'Suppressed (admin)');
assert.equal(ctx.rrNotify_(event('Booked through the Living in Raleigh admin portal.\nInternal booking notification: suppressed (admin booking)\n'),{name:'Ricardo'},'link','reason'),'Suppressed (admin)');assert.equal(mails.length,0);
assert.equal(ctx.rrNotify_(event('Booked through website chat.'),{name:'Benjamin'},'link','reason'),'Sent');assert.equal(mails.length,1);assert.equal(mails[0].to,'livinginraleighteam@gmail.com');
assert.equal(ctx.rrNotify_(event('Booked through Google booking page.'),null,'link','review'),'Sent');assert.equal(mails.length,2);
console.log('Admin notification suppression with tag/description fallback; public bookings and assignment alerts remain active. No real messages sent.');

assert.equal(ctx.rrNotify_(event('Booked through the Living in Raleigh website chat.\nNotes:\nInternal booking notification: suppressed (admin booking)\n'),{name:'Benjamin'},'link','reason'),'Sent');assert.equal(mails.length,3,'Public notes cannot spoof admin suppression');
