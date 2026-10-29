import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope = {};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(new URL('../google-apps-script/chat-booking/PortalAnalytics.gs', import.meta.url), 'utf8'), scope);
function totals() { return {sessions:{},pageViews:{},engagement:{},enquiries:{},bookingVisitors:{},pages:{},daily:{},chats:{},chatBookings:{},latestReal:'2026-10-29T12:00:00Z',oldestDate:'2026-10-29',scanned:0,timingSamples:0}; }
const t = totals();
function event(event, session, pv, path='/', engaged=0, source='metrics_v2') { scope.portalAccumulateEvent_(t,{date:'2026-10-29',event,session,pv,path,engaged,source}); }
event('page_view','a','one'); event('page_view','a','one'); // receiver retry must not inflate pages
event('page_view','a','two','/buy/'); event('page_view','b','three','/consult/');
event('engagement_heartbeat','a','one','/',30000); event('page_exit','a','one','/',45000);
event('page_exit','a','two','/buy/',15000); event('page_exit','b','three','/consult/',20000);
event('chat_conversation_started','a','two','/buy/',0,'chat:first');
event('chat_conversation_started','a','two','/buy/',0,'chat:first');
event('chat_conversation_started','b','three','/consult/',0,'chat:second');
event('chat_appointment_booked','a','two','/buy/',0,'chat:first');
event('chat_appointment_booked','b','three','/consult/',0,'chat:orphan');
event('chat_conversation_started','b','three','/consult/',0,'test-chat:test');
const result = scope.portalAnalyticsResult_(t,'today','2026-10-29','2026-10-29');
assert.equal(result.visits,2); assert.equal(result.pageViews,3); assert.equal(result.averagePages,1.5);
assert.equal(result.averageTimeSeconds,40); assert.equal(result.chatConversations,2);
assert.equal(result.chatBooked,1); assert.equal(result.chatConversion,50); assert.equal(result.bookingVisitors,1);
assert.equal(t.pages['/'],1);
assert.equal(scope.portalPublicLivingPage_('/','https://raleighncguide.com/'),true);
for (const [path,url] of [['/invest/','https://raleighncguide.com/invest/'],['/admin/','https://raleighncguide.com/admin/'],['/','http://127.0.0.1:8777/'],['/raleigh-chat-preview-abc/','https://raleighncguide.com/raleigh-chat-preview-abc/']])
  assert.equal(scope.portalPublicLivingPage_(path,url),false);
assert.equal(scope.portalAnalyticsResult_(totals(),'today','2026-10-29','2026-10-29').chatConversion,null);
scope.CHAT_ZONE='America/New_York'; scope.CHAT_LEAD_SPREADSHEET_ID='test';
scope.Utilities={formatDate:date=>date.toISOString().slice(0,10)};
const tabs={
  'Website Direct Leads':[['Timestamp','Email','Source Page'],[new Date('2026-10-29'),'one@example.com','/quiz/'],[new Date('2026-10-29'),'local@example.com','http://127.0.0.1:8777/']],
  '2026 Relocation Guide - Kit':[['Timestamp','Email'],[new Date('2026-10-29'),'ONE@example.com']],
  'Website Chat Leads':[['Received','Email','Page'],[new Date('2026-10-29'),'two@example.com','/buy/']],
  'Appointments Booked Directly':[['Logged At','Email'],[new Date('2026-10-29'),'two@example.com'],[new Date('2026-10-28'),'old@example.com']]
};
scope.SpreadsheetApp={openById:()=>({getSheetByName:name=>({getDataRange:()=>({getValues:()=>tabs[name].map(row=>row.slice())})})})};
assert.equal(scope.portalLeadCount_('2026-10-29','2026-10-29').count,2);
console.log('Analytics: distinct sessions/pages/contacts, maximum per-page engagement, conversion cohorts, source exclusions and zero-denominator handling pass.');
