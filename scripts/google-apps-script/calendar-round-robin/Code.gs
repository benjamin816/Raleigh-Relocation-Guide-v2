/* Living in Raleigh appointment availability and host assignment.
 * Owned by livinginraleighteam@gmail.com. The existing syncAndInvite trigger
 * calls the same entry point, so the migration can be activated in place.
 */
const RR = {
  targetId: 'livinginraleighteam@gmail.com',
  leadsSpreadsheetId: '1V-4tnKUm22SXO9qTkBpC027gUU1eY_YwS6M2BplU8Uo',
  ledgerName: 'Appointment Assignments',
  notificationEmail: 'livinginraleighteam@gmail.com',
  bookingTitle: 'exploration call',
  lookaheadDays: 30,
  blockTitle: 'BLOCKED OFF',
  maxCreates: 25,
  maxDeletes: 20,
  timeZone: 'America/New_York',
  hosts: [
    {
      name: 'Benjamin', inviteEmail: 'benjamin.carver@exprealty.com',
      calendars: [
        'benjamin.raleighrealtor@gmail.com',
        'benjamindcarver@yahoo.com',
        'mrcarver.jr01@gmail.com'
      ]
    },
    {
      name: 'Ricardo', inviteEmail: 'ricardo@triangleexperts.com',
      calendars: ['ricardo.collier90@gmail.com', 'ricardo@triangleexperts.com']
    }
  ]
};

const RR_HEAD = ['Event ID','Booked At (ET)','Call Start (ET)','Call End (ET)',
  'Assigned To','Assigned Email','Assignment Reason','Status','Last Synced (ET)',
  'Event Link','Notification Sent'];

function syncAndInvite() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { console.log('Another run is active.'); return; }
  try {
    const cutover = PropertiesService.getScriptProperties().getProperty('RR_CUTOVER');
    if (!cutover) { console.log('Round robin is staged. Run activateRoundRobin once.'); return; }
    const ledger = rrLedger_();
    const target = rrCalendar_(RR.targetId);
    const start = new Date();
    const end = new Date(start.getTime() + RR.lookaheadDays * 86400000);
    const busy = rrReadBusy_(start, end);
    const bothBusy = rrIntersect_(busy.Benjamin, busy.Ricardo);
    const desired = rrSubtract_(bothBusy, rrTargetBusy_(target,start,end));
    const blocks = rrSyncBlocks_(target, start, end, desired);
    const assignments = rrAssignBookings_(target, ledger, start, end, busy, new Date(cutover));
    console.log(JSON.stringify({blocks, assignments, bothBusyWindows:bothBusy.length,
      neededNewBlocks:desired.length}));
  } finally { lock.releaseLock(); }
}

// Read-only dry run. Inspect its log before activation.
function previewRoundRobin() {
  const ledger = rrLedger_();
  const target = rrCalendar_(RR.targetId);
  const start = new Date();
  const end = new Date(start.getTime() + RR.lookaheadDays * 86400000);
  const busy = rrReadBusy_(start, end);
  const bothBusy = rrIntersect_(busy.Benjamin, busy.Ricardo);
  const desired = rrSubtract_(bothBusy, rrTargetBusy_(target,start,end));
  const blocks = rrBlocks_(target, start, end);
  const bookings = rrBookings_(target, start, end);
  const rows = rrLedgerRows_(ledger);
  console.log(JSON.stringify({
    sources: RR.hosts.map(h => ({host:h.name, calendars:h.calendars})),
    benBusy:busy.Benjamin.length, ricardoBusy:busy.Ricardo.length,
    bothBusy:bothBusy.length, neededBlocks:desired.length,
    legacyBlocks:blocks.filter(x=>!x.v2).length,
    newBlocks:blocks.filter(x=>x.v2).length, bookings:bookings.length,
    counts:rrCounts_(rows), ledgerRows:rows.length,
    bothBusyFirstFive:desired.slice(0,5).map(x=>({start:x.start.toISOString(),end:x.end.toISOString()}))
  }));
}

// Run only after preview and the ledger tab have been checked. This is the
// cutover boundary: appointments created before it keep their current guests.
function activateRoundRobin() {
  rrLedger_();
  rrCalendar_(RR.targetId);
  const now = new Date();
  rrReadBusy_(now, new Date(now.getTime() + RR.lookaheadDays * 86400000));
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RR_CUTOVER')) props.setProperty('RR_CUTOVER', now.toISOString());
  console.log('Cutover: ' + props.getProperty('RR_CUTOVER'));
  syncAndInvite();
}

// Replace only this project's sync trigger; leave any unrelated triggers alone.
function installTriggers() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncAndInvite')
    .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAndInvite').timeBased().everyMinutes(10).create();
  console.log('Installed 10-minute syncAndInvite trigger.');
}

function rrCalendar_(id) {
  const cal = CalendarApp.getCalendarById(id);
  if (!cal) throw new Error('Calendar is unavailable: ' + id);
  return cal;
}

function rrLedger_() {
  const book = SpreadsheetApp.openById(RR.leadsSpreadsheetId);
  const sheet = book.getSheetByName(RR.ledgerName);
  if (!sheet) throw new Error('Missing Master Leads tab: ' + RR.ledgerName);
  const actual = sheet.getRange(1,1,1,RR_HEAD.length).getDisplayValues()[0];
  if (actual.some((v,i)=>v!==RR_HEAD[i])) throw new Error('Assignment ledger headers changed.');
  return sheet;
}

function rrReadBusy_(start,end) {
  const result = {};
  RR.hosts.forEach(host => {
    const windows = [];
    host.calendars.forEach(id => {
      const cal = rrCalendar_(id); // Fail closed; never treat a missing calendar as free.
      cal.getEvents(start,end).forEach(event => {
        if (event.getTag('MIRROR_BLOCK')==='1' || event.getTag('MIRROR_SOURCE')) return;
        try {
          if (event.getTransparency()===CalendarApp.EventTransparency.TRANSPARENT) return;
          if (event.getMyStatus()===CalendarApp.GuestStatus.NO) return;
        } catch (ignore) {}
        const a = Math.max(start.getTime(),event.getStartTime().getTime());
        const b = Math.min(end.getTime(),event.getEndTime().getTime());
        if (a<b) windows.push({start:new Date(a),end:new Date(b)});
      });
    });
    result[host.name] = rrMerge_(windows);
  });
  return result;
}

function rrMerge_(windows) {
  const sorted = windows.slice().sort((a,b)=>a.start-b.start || a.end-b.end);
  const out = [];
  sorted.forEach(w => {
    const last = out[out.length-1];
    if (last && w.start<=last.end) {
      if (w.end>last.end) last.end=new Date(w.end.getTime());
    } else out.push({start:new Date(w.start.getTime()),end:new Date(w.end.getTime())});
  });
  return out;
}

function rrIntersect_(a,b) {
  const out=[]; let i=0,j=0;
  while (i<a.length && j<b.length) {
    const start=new Date(Math.max(a[i].start.getTime(),b[j].start.getTime()));
    const end=new Date(Math.min(a[i].end.getTime(),b[j].end.getTime()));
    if (start<end) out.push({start,end});
    if (a[i].end<=b[j].end) i++; else j++;
  }
  return rrMerge_(out);
}

// Events already on the shared booking calendar make their times unavailable.
// Subtract those times so the sync does not add duplicate blocks. A partial
// overlap splits the desired block instead of accidentally opening its rest.
function rrTargetBusy_(target,start,end) {
  const windows=[];
  target.getEvents(start,end).forEach(event=>{
    if (event.getTag('MIRROR_BLOCK')==='1' || event.getTag('MIRROR_SOURCE')) return;
    try {
      if (event.getTransparency()===CalendarApp.EventTransparency.TRANSPARENT) return;
    } catch (ignore) {}
    const a=Math.max(start.getTime(),event.getStartTime().getTime());
    const b=Math.min(end.getTime(),event.getEndTime().getTime());
    if (a<b) windows.push({start:new Date(a),end:new Date(b)});
  });
  return rrMerge_(windows);
}

function rrSubtract_(windows,covered) {
  const result=[];
  windows.forEach(w=>{
    let cursor=w.start.getTime();
    covered.forEach(c=>{
      if (c.end.getTime()<=cursor || c.start.getTime()>=w.end.getTime()) return;
      if (c.start.getTime()>cursor) result.push({start:new Date(cursor),
        end:new Date(Math.min(c.start.getTime(),w.end.getTime()))});
      cursor=Math.max(cursor,Math.min(c.end.getTime(),w.end.getTime()));
    });
    if (cursor<w.end.getTime()) result.push({start:new Date(cursor),end:new Date(w.end.getTime())});
  });
  return result;
}

function rrBlocks_(target,start,end) {
  return target.getEvents(start,end).filter(e =>
    e.getTag('MIRROR_BLOCK')==='1' || !!e.getTag('MIRROR_SOURCE')
  ).map(e=>({event:e,v2:e.getTag('RR_VERSION')==='2',
    start:e.getStartTime(),end:e.getEndTime()}));
}

function rrMatchesBlock_(block,w,now) {
  if (block.end.getTime()!==w.end.getTime()) return false;
  if (block.start.getTime()===w.start.getTime()) return true;
  // An interval already in progress is clipped to 'now' on each run.
  return w.start.getTime()===now.getTime() && block.start<=w.start;
}

function rrSyncBlocks_(target,start,end,desired) {
  const existing=rrBlocks_(target,start,end);
  const v2=existing.filter(x=>x.v2);
  let created=0,deleted=0;
  for (const w of desired) {
    if (v2.some(x=>rrMatchesBlock_(x,w,start))) continue;
    if (created>=RR.maxCreates) break;
    const e=target.createEvent(RR.blockTitle,w.start,w.end);
    try {
      e.setTag('MIRROR_BLOCK','1'); e.setTag('RR_VERSION','2');
      e.setVisibility(CalendarApp.Visibility.PRIVATE);
      e.setTransparency(CalendarApp.EventTransparency.OPAQUE);
      e.setDescription('Automatic block: Benjamin and Ricardo are both unavailable.');
      created++;
    } catch (error) { e.deleteEvent(); throw error; }
  }
  // Keep the old blocks until every both-busy interval is covered. The
  // transition may temporarily be conservative, never overbooked.
  const after=rrBlocks_(target,start,end);
  const complete=desired.every(w=>after.some(x=>x.v2 && rrMatchesBlock_(x,w,start)));
  if (complete) {
    const obsolete=after.filter(x=>!x.v2 || !desired.some(w=>rrMatchesBlock_(x,w,start)));
    for (const x of obsolete) {
      if (deleted>=RR.maxDeletes) break;
      x.event.deleteEvent(); deleted++;
    }
  }
  return {legacy:existing.filter(x=>!x.v2).length,created,deleted,complete};
}

function rrBookings_(target,start,end) {
  return target.getEvents(start,end).filter(e=>{
    if (e.getTag('MIRROR_BLOCK')==='1' || e.getTag('MIRROR_SOURCE')) return false;
    return (e.getTitle()||'').trim().toLowerCase().startsWith(RR.bookingTitle);
  }).sort((a,b)=>a.getDateCreated()-b.getDateCreated() || a.getStartTime()-b.getStartTime());
}

function rrLedgerRows_(sheet) {
  const last=sheet.getLastRow();
  if (last<2) return [];
  return sheet.getRange(2,1,last-1,RR_HEAD.length).getValues()
    .map((v,i)=>({row:i+2,values:v,id:String(v[0]||'')})).filter(r=>r.id);
}

function rrCounts_(rows) {
  const counts={Benjamin:0,Ricardo:0};
  rows.forEach(r=>{
    if (r.values[7]!=='Assigned') return;
    if (r.values[4]==='Both') { counts.Benjamin++; counts.Ricardo++; }
    else if (counts[r.values[4]]!==undefined) counts[r.values[4]]++;
  });
  return counts;
}

function rrAvailable_(busy,start,end) {
  return !busy.some(w=>w.start<end && start<w.end);
}

function rrPickHost_(available,counts,rows) {
  if (available.length===1) return {host:available[0],reason:'Only available host'};
  if (!available.length) return null;
  if (counts.Benjamin!==counts.Ricardo)
    return {host:counts.Benjamin<counts.Ricardo ? RR.hosts[0]:RR.hosts[1],reason:'Balancing all assigned calls'};
  const recent=rows.slice().reverse().find(r=>r.values[7]==='Assigned' &&
    (r.values[4]==='Benjamin' || r.values[4]==='Ricardo'));
  const prior=recent && recent.values[4];
  return {host:prior==='Benjamin'?RR.hosts[1]:RR.hosts[0],reason:'Balanced tie'};
}

function rrAssignBookings_(target,sheet,start,end,busy,cutover) {
  const rows=rrLedgerRows_(sheet);
  const byId={}; rows.forEach(r=>byId[r.id]=r);
  const counts=rrCounts_(rows);
  const stats={scanned:0,assigned:0,alreadyAssigned:0,needsReview:0,cancelled:0};
  // Cancellations remove a call from the balancing count, but past completed
  // calls remain counted so forced assignments affect future tie breaks.
  rows.forEach(r=>{
    if (r.values[7]!=='Assigned') return;
    if (String(r.values[2])<rrFormat_(start)) return;
    if (target.getEventById(r.id)) return;
    sheet.getRange(r.row,8).setValue('Cancelled');
    r.values[7]='Cancelled';
    if (r.values[4]==='Both') { counts.Benjamin--; counts.Ricardo--; }
    else if (counts[r.values[4]]!==undefined) counts[r.values[4]]--;
    stats.cancelled++;
  });
  for (const event of rrBookings_(target,start,end)) {
    stats.scanned++;
    const id=event.getId();
    if (byId[id] && byId[id].values[7]==='Assigned') {
      const record=byId[id];
      // Calendar attendees control future assignments; leave notification status untouched.
      if (event.getStartTime()>new Date()) {
        const actual=rrGuestAssignment_(event);
        const previous=String(record.values[4]||'');
        if (actual && (actual.name!==previous || actual.email!==String(record.values[5]||''))) {
          sheet.getRange(record.row,5,1,5).setValues([[actual.name,actual.email,'Manual attendee change','Assigned',rrFormat_(new Date())]]);
          record.values[4]=actual.name; record.values[5]=actual.email; record.values[6]='Manual attendee change';
          if (actual.name!==previous) {
            if (previous==='Both') { counts.Benjamin--; counts.Ricardo--; }
            else if (counts[previous]!==undefined) counts[previous]--;
            if (actual.name==='Both') { counts.Benjamin++; counts.Ricardo++; }
            else counts[actual.name]++;
          }
          event.setTag('RR_ASSIGNED_HOST',actual.name);
          stats.reassigned=(stats.reassigned||0)+1;
        }
      }
      const host=RR.hosts.find(h=>h.name===record.values[4]);
      if (host && record.values[10]!=='Sent') {
        rrNotify_(event,host,rrEventLink_(event),record.values[6]);
        sheet.getRange(record.row,11).setValue('Sent');
        record.values[10]='Sent';
      }
      stats.alreadyAssigned++; continue;
    }
    if (event.getDateCreated()<cutover) continue;
    const s=event.getStartTime(), e=event.getEndTime();
    const available=RR.hosts.filter(h=>rrAvailable_(busy[h.name],s,e));
    if (byId[id] && byId[id].values[7]==='Needs review' && !available.length) {
      stats.needsReview++; continue;
    }
    const existingHosts=rrGuestAssignment_(event);
    const choice=existingHosts ? {host:{name:existingHosts.name,inviteEmail:existingHosts.email},reason:'Existing calendar attendees'} : rrPickHost_(available,counts,rows);
    const link=rrEventLink_(event);
    const prior=byId[id];
    const nowText=rrFormat_(new Date());
    const values=[id,rrFormat_(event.getDateCreated()),rrFormat_(s),rrFormat_(e),
      choice?choice.host.name:'',choice?choice.host.inviteEmail:'',
      choice?choice.reason:'Both hosts busy','',nowText,link,''];
    values[7]=choice?'Assigned':'Needs review';
    const rowNum=prior?prior.row:sheet.getLastRow()+1;
    sheet.getRange(rowNum,1,1,RR_HEAD.length).setValues([values]);
    const record={row:rowNum,values,id};
    if (!prior) rows.push(record); else { prior.values=values; }
    byId[id]=record;
    if (!choice) {
      stats.needsReview++;
      rrNotify_(event,null,link,'Both hosts appear busy; please assign manually.');
      sheet.getRange(rowNum,11).setValue('Sent');
      continue;
    }
    rrEnsureGuest_(event,choice.host);
    event.setTag('RR_ASSIGNED_HOST',choice.host.name);
    if(choice.host.name==='Both'){counts.Benjamin++;counts.Ricardo++;}
    else counts[choice.host.name]++;
    stats.assigned++;
    rrNotify_(event,choice.host,link,choice.reason);
    sheet.getRange(rowNum,11).setValue('Sent');
  }
  return stats;
}

function rrGuestAssignment_(event) {
  const guests=(event.getGuestList()||[]).map(g=>String(g.getEmail()||'').toLowerCase());
  const present=RR.hosts.map(h=>{
    const matched=[h.inviteEmail].concat(h.calendars).find(email=>guests.includes(email.toLowerCase()));
    return matched ? { name:h.name, email:matched } : null;
  }).filter(Boolean);
  if (!present.length) return null;
  return { name:present.length===2 ? 'Both' : present[0].name,
    email:present.map(h=>h.email).join(', ') };
}

function rrEnsureGuest_(event,host) {
  const guests=(event.getGuestList()||[]).map(g=>(g.getEmail()||'').toLowerCase());
  // Automatic assignment may add its host, but must never remove a manually added host.
  String(host.inviteEmail).split(',').map(email=>email.trim()).filter(Boolean).forEach(email=>{
    if(!guests.includes(email.toLowerCase()))event.addGuest(email);
  });
}

function rrEventLink_(event) {
  try {
    const results=Calendar.Events.list(RR.targetId,{iCalUID:event.getId(),maxResults:2});
    const match=(results.items||[]).find(x=>x.htmlLink);
    if (match) return match.htmlLink;
  } catch (error) { console.log('Event link lookup: '+error); }
  return 'https://calendar.google.com/calendar/u/0/r';
}

function rrNotify_(event,host,link,reason) {
  const who=host?host.name:'Needs manual assignment';
  const body='A Living in Raleigh exploration call was booked.\n\n'+
    'Assigned to: '+who+'\n'+
    'When: '+rrFormat_(event.getStartTime())+' to '+rrFormat_(event.getEndTime())+' ET\n'+
    'Reason: '+reason+'\n'+
    'Calendar event: '+link+'\n';
  MailApp.sendEmail({to:RR.notificationEmail,
    subject:'Exploration call booked — '+who+' — '+rrFormat_(event.getStartTime()),body});
}

function rrFormat_(date) {
  return Utilities.formatDate(date,RR.timeZone,'yyyy-MM-dd HH:mm');
}

function previewEventLink() {
  const start=new Date();
  const end=new Date(start.getTime()+RR.lookaheadDays*86400000);
  const event=rrCalendar_(RR.targetId).getEvents(start,end)[0];
  if (!event) throw new Error('No target event available to test its link.');
  console.log(JSON.stringify({id:event.getId(),link:rrEventLink_(event)}));
}

// Read-only test aid. Lists bookable-hour candidates by host availability.
function previewTestSlots() {
  const start=new Date();
  const end=new Date(start.getTime()+14*86400000);
  const busy=rrReadBusy_(start,end);
  const target=rrCalendar_(RR.targetId);
  const sharedBusy=rrMerge_(rrTargetBusy_(target,start,end).concat(
    rrBlocks_(target,start,end).map(x=>({start:x.start,end:x.end}))));
  const out={Benjamin:[],Ricardo:[],Both:[]};
  let t=Math.ceil((start.getTime()+3600000)/3600000)*3600000;
  for (;t+3600000<=end.getTime();t+=3600000) {
    const slot={start:new Date(t),end:new Date(t+3600000)};
    const day=Number(Utilities.formatDate(slot.start,RR.timeZone,'u'));
    const hour=Number(Utilities.formatDate(slot.start,RR.timeZone,'H'));
    if (day>5 || hour<9 || hour>19) continue;
    const overlaps=w=>w.some(x=>slot.start<x.end && slot.end>x.start);
    if (overlaps(sharedBusy)) continue;
    const ben=!overlaps(busy.Benjamin), ricardo=!overlaps(busy.Ricardo);
    const key=ben&&ricardo?'Both':ben?'Benjamin':ricardo?'Ricardo':null;
    if (key && out[key].length<20) out[key].push(rrFormat_(slot.start));
  }
  console.log(JSON.stringify(out));
}
