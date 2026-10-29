import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope = {};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(new URL('../google-apps-script/chat-booking/AdminPortalService.gs', import.meta.url), 'utf8'), scope);
const description = '**Booked by** Test Buyer buyer@example.com 9195550101\n' +
  '**If you would prefer 1\\. A phone call 2\\. An in person meeting at our North\nRaleigh office Please indicate so here!** 1\n' +
  '**Please include any information you would like me to know before our\nmeeting!** Meet with Benjamin/Ricardo\n' +
  '**Please indicate whether you are looking to buy, sell, or invest in Raleigh**\nBuy\n' +
  "I'm looking forward to meeting you! To get started, please choose a day and time.";
function event(text) { return { getDescription: () => text, getTitle: () => 'Exploration Call: Living in Raleigh Team (Test Buyer)' }; }
let result = scope.adminBookingDetails_(event(description));
assert.equal(result.type, 'Phone call');
assert.equal(result.client, 'Test Buyer');
assert.equal(result.email, 'buyer@example.com');
assert.equal(result.phone, '9195550101');
assert.equal(result.notes, 'Meet with Benjamin/Ricardo');
assert.equal(result.purpose, 'Buy');
const html = description.replace(/\*\*/g, '').replace(/\n/g, '<br>');
assert.equal(scope.adminBookingDetails_(event(html)).notes, 'Meet with Benjamin/Ricardo');
assert.equal(scope.adminMeetingType_(description.replace('here!** 1', 'here!** 2')), 'North Raleigh office');
assert.equal(scope.adminMeetingType_(description.replace('here!** 1', 'here!** ')), 'Google video call');
const plain = description.replace(/\*\*/g, '').replace('Booked by ', 'Booked by:\n').replace('here! 1', 'here!\nPhone call');
assert.equal(scope.adminMeetingType_(plain), 'Phone call');
assert.equal(scope.adminBookingDetails_(event(description.replace('Meet with Benjamin/Ricardo', 'First line\nSecond line'))).notes, 'First line\nSecond line');
console.log('Appointment descriptions: formatted, HTML, plain text, meeting preference, goal, contact details, and multiline notes pass.');
scope.CHAT_CALENDAR_ID = 'team@example.com';
scope.Calendar = { Events: { list: () => ({ items: [{ htmlLink: 'https://calendar.google.com/event', hangoutLink: 'https://meet.google.com/test-link' }] }) } };
assert.equal(scope.adminEventLinks_({getId:()=> 'test'}, 'Phone call').videoUrl, '');
assert.equal(scope.adminEventLinks_({getId:()=> 'test'}, 'North Raleigh office').videoUrl, '');
assert.equal(scope.adminEventLinks_({getId:()=> 'test'}, 'Google video call').videoUrl, 'https://meet.google.com/test-link');
const rr = {};
vm.createContext(rr);
vm.runInContext(fs.readFileSync(new URL('../google-apps-script/calendar-round-robin/Code.gs', import.meta.url), 'utf8'), rr);
const guests = ['benjamin.carver@exprealty.com', 'ricardo@triangleexperts.com'];
const appointment = { getGuestList: () => guests.map(email => ({ getEmail: () => email })),
  addGuest(email) { guests.push(email); }, removeGuest() { throw new Error('Automatic guest removal forbidden'); } };
rr.rrEnsureGuest_(appointment, { name: 'Benjamin', inviteEmail: guests[0] });
assert.equal(guests.length, 2);
assert.equal(rr.rrGuestAssignment_(appointment).name, 'Both');
guests.splice(0, 1);
assert.equal(rr.rrGuestAssignment_(appointment).name, 'Ricardo');
console.log('Round robin preserves a manually added host and reads Both/solo attendee assignments.');
scope.CHAT_HOSTS = [
  {name:'Benjamin',inviteEmail:'benjamin.carver@exprealty.com',calendars:['benjamin.raleighrealtor@gmail.com']},
  {name:'Ricardo',inviteEmail:'ricardo@triangleexperts.com',calendars:['ricardo.collier90@gmail.com']}
];
scope.CHAT_ZONE = 'America/New_York';
scope.LockService = {getScriptLock:()=>({waitLock(){},releaseLock(){}})};
scope.Utilities = {formatDate:()=> '2026-10-29 16:00'};
const attendeeSet = new Set(['benjamin.carver@exprealty.com','benjamin.raleighrealtor@gmail.com','client@example.com']);
const row = ['test-event', '', '', '', 'Benjamin', '', '', 'Assigned', '', '', 'Sent'];
const edited = {getId:()=> 'test-event',getGuestList:()=> [...attendeeSet].map(email=>({getEmail:()=>email})),
  addGuest:email=>attendeeSet.add(email),removeGuest:email=>attendeeSet.delete(email),setTag(){}};
scope.adminFindEvent_=()=> edited;
scope.adminHostConflict_=()=> false;
scope.adminAssignmentIndex_=()=>({byId:{'test-event':row},sheet:{getLastRow:()=>2,getRange:(r,c)=>({getValues:()=>[row],
  setValues:values=>values[0].forEach((value,i)=>{row[c-1+i]=value;})})}});
scope.adminChangeAssignment_({host:'Ricardo',expectedHost:'Benjamin',id:'test-event',confirm:true},{email:'admin@example.com'});
assert.deepEqual([...attendeeSet].sort(),['client@example.com','ricardo@triangleexperts.com']);
assert.equal(row[4],'Ricardo');
assert.equal(row[10],'Sent');
scope.adminChangeAssignment_({host:'Both',expectedHost:'Ricardo',id:'test-event',confirm:true},{email:'admin@example.com'});
assert(attendeeSet.has('benjamin.carver@exprealty.com'));
assert(attendeeSet.has('ricardo@triangleexperts.com'));
assert.equal(row[4],'Both');
assert.equal(row[10],'Sent');
console.log('Portal transfers remove alternate host emails, preserve clients, support Both, and keep email receipt unchanged.');
