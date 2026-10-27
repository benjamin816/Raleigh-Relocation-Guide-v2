const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname + '/Code.gs', 'utf8');
const assignmentHeaders = ['Event ID','Booked At (ET)','Call Start (ET)','Call End (ET)',
  'Assigned To','Assigned Email','Assignment Reason','Status','Last Synced (ET)',
  'Event Link','Notification Sent'];
const schedules = new Map();
let calendarReads = 0;
const calendars = {
  getCalendarById(id) {
    if (!schedules.has(id)) schedules.set(id, []);
    return { getEvents() { calendarReads += 1; return schedules.get(id); }, getEventById() { return { setTag() {} }; },
      createEvent() { createdEvents += 1; return { getId() { return 'test-event-' + createdEvents; }, setTag() {} }; } };
  },
  EventTransparency: { TRANSPARENT: 'transparent' },
  GuestStatus: { NO: 'no' }
};
let createdEvents = 0;
const context = vm.createContext({ CalendarApp: calendars });
vm.runInContext(source, context);
const start = new Date('2026-11-05T17:00:00.000Z');
const end = new Date('2026-11-05T18:00:00.000Z');
const busy = { getTag() { return null; }, getTransparency() { return 'opaque'; }, getMyStatus() { return 'yes'; } };
const free = { getTag() { return null; }, getTransparency() { return 'transparent'; }, getMyStatus() { return 'yes'; } };
const mirror = { getTag(key) { return key === 'MIRROR_BLOCK' ? '1' : null; }, getTransparency() { return 'opaque'; }, getMyStatus() { return 'yes'; } };

function available() { return Array.from(context.chatAvailableHosts_(start, end), host => host.name); }
assert.deepEqual(available(), ['Benjamin', 'Ricardo']);
schedules.set('ricardo.collier90@gmail.com', [busy]);
assert.deepEqual(available(), ['Benjamin']);
schedules.set('ricardo.collier90@gmail.com', []);
schedules.set('benjamin.raleighrealtor@gmail.com', [busy]);
assert.deepEqual(available(), ['Ricardo']);
schedules.set('ricardo.collier90@gmail.com', [busy]);
assert.deepEqual(available(), []);
schedules.set('benjamin.raleighrealtor@gmail.com', [free, mirror]);
assert.deepEqual(available(), ['Benjamin']);
schedules.set('livinginraleighteam@gmail.com', [busy]);
context.chatSlotAllowed_ = () => true;
assert.equal(context.chatSlotFree_(start, {}), false, 'Team event blocks the shared slot');
schedules.set('livinginraleighteam@gmail.com', [mirror]);
assert.equal(context.chatSlotFree_(start, {}), false, 'Existing shared-calendar block matches /consult/');
schedules.set('livinginraleighteam@gmail.com', []);
assert.equal(context.chatSlotFree_(start, {}), true, 'One available host is sufficient');
schedules.set('ricardo.collier90@gmail.com', []);
const cache = new Map();
const properties = new Map();
const leadRows = [];
const assignmentRows = [];
context.CacheService = { getScriptCache() { return {
  get(key) { return cache.get(key) || null; },
  put(key, value) { cache.set(key, value); }
}; } };
context.PropertiesService = { getScriptProperties() { return {
  getProperty(key) { return properties.get(key) || null; },
  setProperty(key, value) { properties.set(key, value); }
}; } };
context.LockService = { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } };
context.Utilities = {
  formatDate(date, _zone, pattern) {
    if (pattern === 'H') return String(date.getHours());
    if (pattern === 'u') return String(date.getDay() || 7);
    if (pattern === 'yyyy-MM-dd') return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    return '20261105';
  },
  DigestAlgorithm: { SHA_256: 'sha256' },
  computeDigest(_algorithm, value) { return Array(32).fill(String(value).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 255); }
};
context.SpreadsheetApp = { openById() { return { getSheetByName(name) {
  return name === 'Appointment Assignments' ? ledger : sheet;
}, insertSheet() { return sheet; } }; } };
const sentEmails = [];
context.MailApp = { sendEmail(...args) { sentEmails.push(args); } };
const sheet = { getLastRow() { return leadRows.length; }, appendRow(row) { leadRows.push(row); } };
const ledger = { getLastRow() { return assignmentRows.length + 1; },
  getRange(row) { return { getDisplayValues() { return [assignmentHeaders]; },
    getValues() { return assignmentRows.slice(row - 2); } }; },
  appendRow(row) { assignmentRows.push(row); } };
context.chatSlotFree_ = () => true;
context.chatBookingWindows_ = () => [];
context.chatAssignmentRows_ = () => ({ sheet: ledger, rows: assignmentRows });
context.chatBookingWindows_ = () => Array.from({ length: 7 }, () => [['12:00','14:00'],['18:00','20:00']]);
calendarReads = 0;
assert.deepEqual(Array.from(context.getChatBookingSlots().slice(0, 2), slot => slot.daypart),
  ['afternoon', 'evening'], 'Default options include afternoon and evening');
assert.equal(calendarReads, 6, 'Availability reads the shared calendar and five host calendars once each');
assert.equal(context.getChatBookingSlots({ daypart: 'evening' }).every(slot => slot.daypart === 'evening'), true);
context.chatBookingWindows_ = () => [];
const details = { requestId: 'test-request-123456789', start: start.toISOString(), name: 'Test Person', email: 'test@example.com', phone: '9195550100', notes: '=IMPORTXML("bad")' };
assert.equal(context.chatPickHost_(context.CHAT_HOSTS || [{name:'Benjamin'},{name:'Ricardo'}],
  [['old', '', '', '', 'Benjamin', '', '', 'Assigned']], '').host.name, 'Ricardo');
assert.equal(context.chatBookingPreference_({host:'ricardo',daypart:'evening',weekdays:[0,6,9]}).host, 'Ricardo');
assert.equal(context.bookChatAppointment(details).booked, true);
assert.equal(context.bookChatAppointment(details).booked, true, 'Retry returns the same receipt');
assert.equal(createdEvents, 1, 'Retry cannot create a second event');
assert.equal(sentEmails.length, 1, 'Retry cannot send a second pre-call email');
assert.equal(sentEmails[0][0].subject, 'What To Know Before Our Call (Living in Raleigh Team)');
assert.match(sentEmails[0][0].body, /meeting with Benjamin/);
assert.equal(context.bookChatAppointment(details).preCallEmailSent, true);
assert.equal(leadRows.length, 2, 'One booking row and one header');
assert.equal(leadRows[1][6], "'=IMPORTXML(\"bad\")", 'Spreadsheet formula is escaped');
assert.equal(assignmentRows[0][4], 'Benjamin', 'First tie goes to Benjamin');
let videoPayload;
context.ScriptApp = { getOAuthToken() { return 'test-token'; } };
context.UrlFetchApp = { fetch(url, options) {
  assert.match(url, /conferenceDataVersion=1/);
  videoPayload = JSON.parse(options.payload);
  return { getResponseCode() { return 200; }, getContentText() { return JSON.stringify({
    iCalUID: 'video-event@example.com', hangoutLink: 'https://meet.google.com/abc-defg-hij'
  }); } };
} };
const video = context.bookChatAppointment({ ...details, requestId: 'test-video-123456789', email: 'video@example.com', callType: 'video' });
assert.equal(video.videoUrl, 'https://meet.google.com/abc-defg-hij');
assert.equal(videoPayload.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
assert.equal(videoPayload.attendees[1].email, 'ricardo@triangleexperts.com', 'Second call balances toward Ricardo');
assert.equal(leadRows[2][7], 'Website chat · video');
assert.equal(assignmentRows[1][4], 'Ricardo');
assert.match(sentEmails[1][0].body, /meeting with Ricardo/);
assert.match(sentEmails[1][0].body, /video call/);
schedules.set('ricardo.collier90@gmail.com', [busy]);
assert.throws(() => context.bookChatAppointment({ ...details, requestId: 'test-request-444444444', preferredHost: 'Ricardo', email: 'unavailable@example.com' }), /no longer available/i);
schedules.set('ricardo.collier90@gmail.com', []);
const requested = context.bookChatAppointment({ ...details, requestId: 'test-request-333333333', preferredHost: 'Ricardo', email: 'other@example.com' });
assert.equal(requested.assignedHost, 'Ricardo', 'Explicit host request overrides balanced tie');
assert.equal(assignmentRows[2][6], 'Requested host');
assert.throws(() => context.bookChatAppointment({ ...details, requestId: 'test-request-222222222', phone: '' }), /booking details/i);
console.log('Chat booking availability, direct booking and duplicate checks passed');
