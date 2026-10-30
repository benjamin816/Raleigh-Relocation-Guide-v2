const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const repo=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(repo,'assets/js/raleigh-chat.js'),'utf8');
const cs={window:{}};vm.runInNewContext(fs.readFileSync(path.join(repo,'assets/js/raleigh-chat-config.js'),'utf8'),cs);
const config=JSON.parse(JSON.stringify(cs.window.RaleighChatConfig));
config.bookingRelayUrl='https://blocked.invalid/booking';config.bookingBridgeUrl='';config.leadEndpoint='';config.chatAttachmentsEnabled=false;
const bounds=[...source.matchAll(/^  function ([\w]+)\(/gm)],funcs={};
for(let i=0;i<bounds.length;i++)funcs[bounds[i][1]]=source.slice(bounds[i].index,i+1<bounds.length?bounds[i+1].index:source.length);
const needed=['requestContactPermission','bookingToken','bookingLabel','bookingDayKey','bookingSlotParts','requestedClock','bookingPreferenceFromText','hasBookingPreference','offeredBookingChoice','normalizeSuggestedTime','bookingFailed','showBookingPair','offerBookingSlots','startBooking','loadBookingSlots','handleBookingAnswer'];
for(const n of needed)assert(funcs[n],`missing ${n}`);
const slots=[
 {start:'2026-11-05T18:00:00.000Z',daypart:'afternoon',availableHosts:['Benjamin','Ricardo']},
 {start:'2026-11-06T22:00:00.000Z',daypart:'evening',availableHosts:['Benjamin','Ricardo']},
 {start:'2026-11-07T15:00:00.000Z',daypart:'morning',availableHosts:['Benjamin']},
 {start:'2026-11-07T18:00:00.000Z',daypart:'afternoon',availableHosts:['Ricardo']}
];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(options={}){
 const messages=[],calls=[],events=[],storage=[],analytics=[];let token=0;
 const state={intent:options.intent||'buying',profile:{...(options.profile||{})},history:[],booking:null,ended:false};
 let bookAttempt=0,resolveDeferred;
 const fakeBookingCall=(method,args)=>{
   calls.push({method,args:JSON.parse(JSON.stringify(args||[]))});
   if(method==='slots')return Promise.resolve(options.slots||slots);
   if(method==='suggest')return Promise.resolve(options.suggest||{available:false});
   if(method==='book'){
     bookAttempt++;
     if(options.deferBook&&bookAttempt===1)return new Promise(resolve=>{resolveDeferred=resolve;});
     if(options.bookErrors&&options.bookErrors[bookAttempt-1])return Promise.reject(new Error(options.bookErrors[bookAttempt-1]));
     const payload=args[0];return Promise.resolve({booked:true,start:payload.start,assignedHost:payload.preferredHost||'Benjamin',callType:payload.callType,videoUrl:payload.callType==='video'?'https://meet.example.test/safe':''});
   }
   return Promise.reject(new Error('Unexpected mocked booking method: '+method));
 };
 const blocked=()=>{throw new Error('ISOLATION FAILURE: unmocked external side effect attempted');};
 const context={config,state,Date,Intl,console,attachment:null,attachmentInput:{value:''},input:{},sendButton:{},
   persist(){},message:t=>messages.push(String(t)),link:(label,href)=>messages.push(`[LINK] ${label} -> ${href}`),bookingCall:fakeBookingCall,
   trackConversation:name=>analytics.push(name),submitBookingAttachment:blocked,showAttachment(){},
   finishConversation(){state.ended=true;},fetch:blocked,XMLHttpRequest:blocked,WebSocket:blocked,EventSource:blocked,
   window:{crypto:{getRandomValues(a){for(let i=0;i<a.length;i++)a[i]=(token++%250)+1;return a;}},localStorage:{setItem(k,v){storage.push([k,v]);}},dispatchEvent:e=>events.push(e.type),CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail;},fetch:blocked,open:blocked,setTimeout:blocked},
   CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail;}
 };
 vm.createContext(context);for(const n of needed)vm.runInContext(funcs[n],context);
 return {context,state,messages,calls,events,storage,analytics,start:v=>context.startBooking(v),send:v=>context.handleBookingAnswer(v),resolveBook(result){assert(resolveDeferred,'no deferred booking call');resolveDeferred(result);}};
}
async function settle(){await tick();await tick();}
async function start(h,request){h.start(request);await settle();}
function bookCalls(h){return h.calls.filter(c=>c.method==='book');}
async function complete(h,{choice='the first one',email='buyer@example.com',phone='9195550101',name='Test Buyer',notes='Synthetic isolated QA'}={}){
 h.send(choice);h.send(email);h.send(phone);h.send(name);h.send(notes);await settle();
}
const results=[];async function test(name,fn){try{const detail=await fn();results.push({name,status:'pass',detail});}catch(e){results.push({name,status:'fail',error:e.stack});}}

(async()=>{
await test('phone booking completes through real state machine',async()=>{const h=harness();await start(h,'Please book a phone call');assert.equal(h.state.booking.step,'choose');await complete(h,{});assert.equal(bookCalls(h).length,1);const p=bookCalls(h)[0].args[0];const expected={name:'Test Buyer',email:'buyer@example.com',phone:'9195550101',notes:'Synthetic isolated QA',callType:'phone',purpose:'Buy'};const actual={name:p.name,email:p.email,phone:p.phone,notes:p.notes,callType:p.callType,purpose:p.purpose};assert.deepEqual(actual,expected);assert(h.messages.at(-1).includes("I've got you confirmed"));assert.deepEqual(h.events,['raleigh-booking-confirmed']);assert.deepEqual(h.analytics,['chat_appointment_booked']);return {expected,actual,requestId:p.requestId,start:p.start,confirmation:h.messages.at(-1),events:h.events,analytics:h.analytics};});
await test('video booking uses second slot and renders Meet confirmation',async()=>{const h=harness();await start(h,'Book a video call');await complete(h,{choice:'the second one',email:'video@example.com',name:'Video Tester'});const p=bookCalls(h)[0].args[0];assert.equal(p.start,slots[1].start);assert.equal(p.callType,'video');assert.match(h.messages.at(-1),/Google Meet link is in the invitation/);return {expectedStart:slots[1].start,actualPayload:p,confirmation:h.messages.at(-1)};});
await test('more-times revision cycles offered slots before booking',async()=>{const h=harness();await start(h,'Book a phone call');h.send('more times');assert.equal(h.state.booking.offset,2);await complete(h,{choice:'the first one',email:'revision@example.com',name:'Revision Tester'});assert.equal(bookCalls(h)[0].args[0].start,slots[2].start);});
await test('unavailable exact suggestion recovers to offered slots',async()=>{const h=harness({suggest:{available:false}});await start(h,'Book a phone call');h.send('Saturday at noon');await settle();assert(h.calls.some(c=>c.method==='suggest'));assert.equal(h.state.booking.step,'choose');await complete(h,{email:'recovery@example.com',name:'Recovery Tester'});assert.equal(bookCalls(h).length,1);});
await test('invalid email phone and name are rejected then corrected',async()=>{const h=harness();await start(h,'Book a phone call');h.send('the first one');h.send('not-an-email');assert.equal(h.state.booking.step,'email');h.send('valid@example.com');h.send('123');assert.equal(h.state.booking.step,'phone');h.send('9195550102');h.send('Cher');assert.equal(h.state.booking.step,'name');h.send('Cher Tester');h.send('skip');await settle();assert.equal(bookCalls(h).length,1);assert.equal(bookCalls(h)[0].args[0].notes,'');assert(h.messages.some(m=>/check that email/.test(m)));assert(h.messages.some(m=>/at least 10 digits/.test(m)));assert(h.messages.some(m=>/first and last name/.test(m)));});
await test('cancellation at slot choice creates no booking',async()=>{const h=harness();await start(h,'Book a phone call');h.send('cancel');assert.equal(h.state.booking,null);assert.equal(bookCalls(h).length,0);assert.match(h.messages.at(-1),/No call was booked/);return {bookCalls:0,finalMessage:h.messages.at(-1)};});
await test('generic book failure returns to notes and succeeds on retry',async()=>{const h=harness({bookErrors:['Synthetic booking failure']});await start(h,'Book a phone call');h.send('the first one');h.send('retry@example.com');h.send('9195550103');h.send('Retry Tester');h.send('first try');await settle();assert.equal(h.state.booking.step,'notes');assert.match(h.messages.at(-1),/Synthetic booking failure/);h.send('second try');await settle();assert.equal(bookCalls(h).length,2);assert.match(h.messages.at(-1),/confirmed/);});
await test('taken slot reloads and alternate slot can complete',async()=>{const h=harness({bookErrors:['That time was taken. Please choose another.']});await start(h,'Book a phone call');h.send('the first one');h.send('taken@example.com');h.send('9195550104');h.send('Taken Tester');h.send('skip');await settle();assert.equal(h.state.booking.step,'choose');h.send('the second one');h.send('taken@example.com');h.send('9195550104');h.send('Taken Tester');h.send('skip');await settle();assert.equal(bookCalls(h).length,2);assert.match(h.messages.at(-1),/confirmed/);});
await test('duplicate input while confirming does not duplicate book call',async()=>{const h=harness({deferBook:true});await start(h,'Book a phone call');h.send('the first one');h.send('duplicate@example.com');h.send('9195550105');h.send('Duplicate Tester');h.send('skip');h.send('submit again');assert.equal(bookCalls(h).length,1);assert.match(h.messages.at(-1),/One moment/);const p=bookCalls(h)[0].args[0];h.resolveBook({booked:true,start:p.start,assignedHost:'Benjamin',callType:p.callType,videoUrl:''});await settle();assert.equal(bookCalls(h).length,1);assert.match(h.messages.at(-1),/confirmed/);});
await test('privacy no-scheduling guard blocks startBooking and all service calls',async()=>{const h=harness({profile:{noScheduling:true}});await start(h,'Book a phone call');assert.equal(h.state.booking,null);assert.equal(h.calls.length,0);assert.match(h.messages.at(-1),/without scheduling/);return {bookingCalls:0,finalMessage:h.messages.at(-1)};});
await test('selling booking payload carries Sell purpose',async()=>{const h=harness({intent:'selling'});await start(h,'Book a phone call');await complete(h,{email:'seller@example.com',name:'Seller Tester'});assert.equal(bookCalls(h)[0].args[0].purpose,'Sell');});

await test('contact boundary requires explicit permission before slots',async()=>{const h=harness({profile:{noContact:true}});await start(h,'Book a call');assert.equal(h.calls.length,0);assert.equal(h.state.profile.pendingContactPermission,'booking');assert.match(h.messages.at(-1),/Would you like to continue/);});
await test('research-only profile cannot enter booking',async()=>{const h=harness({profile:{researchOnly:true}});await start(h,'Automatic flow completion');assert.equal(h.calls.length,0);assert.equal(h.state.booking,null);});
const failed=results.filter(result=>result.status==='fail');
if(failed.length){console.error(JSON.stringify(failed,null,2));process.exitCode=1;}
else console.log(`${results.length} isolated booking-state regression journeys passed. Real state-machine logic, mocked booking services, no live network requests.`);
})();