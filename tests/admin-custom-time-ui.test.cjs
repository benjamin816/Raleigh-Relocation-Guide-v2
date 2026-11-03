const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('admin/consult/script.js','utf8'),html=fs.readFileSync('admin/consult/index.html','utf8');
assert(fs.readFileSync('admin/portal.js','utf8').includes('/admin/consult/?portal=1&v=20261103-calendars2'));
assert(fs.readFileSync('admin/index.html','utf8').includes('/admin/consult/?portal=1&v=20261103-calendars2'));
assert(fs.readFileSync('admin/index.html','utf8').includes('/admin/portal.js?v=20261103-calendars2'));
class Element{constructor(tag='div'){this.tagName=tag;this.children=[];this.events={};this.hidden=false;this.disabled=false;this.value='';this.attrs={};this.open=false;}append(...v){this.children.push(...v)}appendChild(v){this.children.push(v);return v}replaceChildren(){this.children=[]}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.events[k]=fn}focus(){}showModal(){this.open=true}close(){this.open=false}fire(k,extra={}){return this.events[k]?.({preventDefault(){},target:this,currentTarget:this,...extra})}}
const ids={};for(const m of html.matchAll(/id="([^"]+)"/g))ids[m[1]]=new Element();
const hosts=['Benjamin','Ricardo','Both'].map(value=>Object.assign(new Element('input'),{value,name:'host',checked:false}));
function slots(){return ids.days.children.flatMap(c=>c.children.filter(x=>x.className==='slot-choice').map(x=>x.children[0]));}
const document={getElementById:id=>{assert(ids[id],id);return ids[id]},createElement:t=>new Element(t),querySelector:s=>s.includes('host')?hosts.find(h=>h.checked):slots().find(s=>s.checked),querySelectorAll:s=>s.includes('host')?hosts:slots()};
const calls=[];let conflict=false,fail=false,held=null;const publicSlots=[{start:'2026-11-03T17:00:00.000Z',availableHosts:['Benjamin','Ricardo']}];
const fetch=async(_url,options)=>{const req=JSON.parse(options.body);calls.push(req);const action=req.args[1];let result;
 if(req.method==='slots')result={slots:publicSlots,nextUp:'Benjamin'};
 else if(action==='session')result={viewer:{email:'fixture@example.invalid'}};
 else if(action==='customCheck'){
  if(held)await held;
  if(fail)return {ok:true,json:async()=>({ok:false,error:'Could not read all required calendars.'})};
  result={available:!conflict,host:req.args[2].host,start:'2026-11-06T02:15:00.000Z',conflicts:conflict?[{host:req.args[2].host,start:'2026-11-06T02:00:00Z',end:'2026-11-06T03:00:00Z'}]:[]};
 }else if(action==='customBook'||action==='book')result={booked:true,assignedHost:req.args[2].preferredHost};else throw Error('Unexpected action');
 return {ok:true,json:async()=>({ok:true,result})};};
const ctx=vm.createContext({window:{RALEIGH_BOOKING_RELAY_URL:'https://isolated.invalid',parent:{}},document,location:{search:'?portal=1'},sessionStorage:{getItem:()=> 'isolated-admin'},fetch,Intl,Date,URLSearchParams,crypto:require('node:crypto').webcrypto,Uint8Array,FormData:class{get(k){return {name:'Fixture Person',email:'fixture@example.invalid',phone:'9195550100',callType:'phone',purpose:'Buy',notes:'Isolated test'}[k]}},console,setTimeout,clearTimeout});
async function tick(){await new Promise(setImmediate)}
function select(name){hosts.forEach(h=>h.checked=h.value===name);hosts.find(h=>h.checked).fire('change');}
(async()=>{vm.runInContext(source,ctx);await tick();assert.equal(ids.availability.hidden,true);select('Ricardo');assert.equal(ids.days.children.length,5);
 for(const col of ids.days.children){const plus=col.children.at(-1);assert.equal(plus.textContent,'+');assert.equal(plus.className,'custom-slot');assert(plus.attrs['aria-label'].includes('Add private custom time'));}
 ids.days.children[0].children.at(-1).fire('click');assert.equal(ids['custom-time-dialog'].open,true);assert.match(ids['custom-host'].textContent,/Ricardo/);
 ids['custom-date'].value='bad';ids['custom-time'].value='21:15';ids['custom-time-form'].fire('submit');await tick();assert.match(ids['custom-result'].textContent,/valid date/);assert(!calls.some(c=>c.args[1]==='customCheck'));
 ids['custom-date'].value='2026-11-05';conflict=true;ids['custom-time-form'].fire('submit');await tick();assert.equal(ids['custom-use'].disabled,true);assert.match(ids['custom-result'].textContent,/overlaps.*Ricardo/);
 conflict=false;fail=true;ids['custom-time-form'].fire('submit');await tick();assert.equal(ids['custom-use'].disabled,true);assert.match(ids['custom-result'].textContent,/Could not read/);
 fail=false;ids['custom-time-form'].fire('submit');await tick();assert.equal(ids['custom-use'].disabled,false);
 ids['custom-time'].value='22:00';ids['custom-time'].fire('input');assert.equal(ids['custom-use'].disabled,true,'Editing invalidates verified time');
 ids['custom-time'].value='21:15';ids['custom-time-form'].fire('submit');await tick();ids['custom-use'].fire('click');assert.equal(ids['custom-time-dialog'].open,false);assert.equal(ids['custom-selected'].hidden,false);assert.equal(ids['book-button'].disabled,false);
 ids['booking-form'].reset=()=>hosts.forEach(h=>h.checked=false);ids['booking-form'].fire('submit');await tick();const booking=calls.find(c=>c.args[1]==='customBook');assert(booking);assert.equal(booking.args[2].date,'2026-11-05');assert.equal(booking.args[2].time,'21:15');assert.equal(booking.args[2].preferredHost,'Ricardo');assert.equal(publicSlots.length,1);assert(!publicSlots.some(s=>s.start===booking.args[2].start));assert.match(ids.status.textContent,/Booked with Ricardo/);
 select('Both');ids.days.children[0].children.at(-1).fire('click');ids['custom-date'].value='2026-11-05';ids['custom-time'].value='21:15';let release;held=new Promise(r=>release=r);ids['custom-time-form'].fire('submit');await tick();ids['custom-time'].value='22:00';ids['custom-time'].fire('input');release();held=null;await tick();assert.equal(ids['custom-use'].disabled,true,'Stale response after edit cannot enable selection');
 select('Benjamin');assert.equal(ids['custom-time-dialog'].open,false);assert.equal(ids['custom-selected'].hidden,true);assert.equal(ids['book-button'].disabled,true);
 console.log('Admin UI: + at the bottom of all five days, host gating, invalid inputs, conflict/read failure, changed inputs, stale responses, and complete custom booking flow passed with mocked fetch. No real booking service called.');
})().catch(e=>{console.error(e);process.exitCode=1});
