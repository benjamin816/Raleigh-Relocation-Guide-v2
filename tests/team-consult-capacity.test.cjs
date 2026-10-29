const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const chat={CalendarApp:{EventTransparency:{TRANSPARENT:'free'}}}; vm.createContext(chat);
vm.runInContext(fs.readFileSync('scripts/google-apps-script/chat-booking/Code.gs','utf8'),chat);
const rr={CalendarApp:chat.CalendarApp};vm.createContext(rr);vm.runInContext(fs.readFileSync('scripts/google-apps-script/calendar-round-robin/Code.gs','utf8'),rr);
function event(id,created,hosts){let changes=0;return {getId:()=>id,getDateCreated:()=>new Date(created),getTransparency:()=> 'busy',setTransparency:()=>changes++,changes:()=>changes,
 getTitle:()=> 'Exploration Call: Living in Raleigh Team (Test)',getTag:key=>key==='RR_ASSIGNED_HOST'?(hosts.length===2?'Both':hosts[0]||''):'',
 getGuestList:()=>hosts.map(name=>({getEmail:()=>name==='Benjamin'?'benjamin.carver@exprealty.com':'ricardo@triangleexperts.com'})),
 getStartTime:()=>new Date('2026-11-01T15:00Z'),getEndTime:()=>new Date('2026-11-01T16:00Z')};}
for(const name of ['chatSetTeamFree_','rrSetTeamFree_']){
 const scope=name.startsWith('chat')?chat:rr;
 const friday=event('0k0km3phn87a8g0m8f2pguhf3k@google.com','2026-11-01',['Ricardo']);scope[name](friday);assert.equal(friday.changes(),0);
 const old=event('existing','2026-10-28',['Benjamin']);scope[name](old);assert.equal(old.changes(),0);
 const next=event('new','2026-10-30',['Ricardo']);scope[name](next);assert.equal(next.changes(),1);
}
const ben=event('ben','2026-10-30',['Benjamin']),both=event('both','2026-10-30',['Benjamin','Ricardo']);
let assigned=chat.chatAssignedBusy_(null,null,null,[ben]);assert.equal(assigned.Benjamin.length,1);assert.equal(assigned.Ricardo.length,0);
assigned=chat.chatAssignedBusy_(null,null,null,[both]);assert.equal(assigned.Benjamin.length,1);assert.equal(assigned.Ricardo.length,1);
assigned=chat.chatAssignedBusy_(null,null,'both',[both]);assert.equal(assigned.Benjamin.length,0);
rr.CalendarApp.getCalendarById=id=>({getEvents:()=>id==='livinginraleighteam@gmail.com'?[ben]:[]});
const busy=rr.rrReadBusy_(new Date('2026-11-01T14:00Z'),new Date('2026-11-01T17:00Z'));
assert.equal(busy.Benjamin.length,1);assert.equal(busy.Ricardo.length,0);
console.log('New consults become Free on team calendar; old events and Friday remain unchanged. Assigned host and Both reservations survive Free/RSVP state; transfer excludes its own event.');
