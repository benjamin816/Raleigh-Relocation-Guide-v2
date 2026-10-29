const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ Date, JSON, Number, Object, String, RegExp, Error,
  CHAT_ZONE: 'America/New_York',
  Utilities: { formatDate: date => date.toISOString().slice(0, 10) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'ADMIN_GOOGLE_CLIENT_ID' ? 'client.apps.googleusercontent.com' : '' }) },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({
    aud: 'client.apps.googleusercontent.com', iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 3600, email_verified: true,
    email: 'benjamin.raleighrealtor@gmail.com', name: 'Benjamin' }) }) }
});
vm.runInContext(fs.readFileSync(__dirname + '/AdminPortalService.gs', 'utf8'), context);
const read = code => vm.runInContext(code, context);
assert.equal(read("adminVerifyToken_('a'.repeat(120)).email"), 'benjamin.raleighrealtor@gmail.com');
assert.equal(read("adminMeetingType_('If you would prefer 1. A phone call 2. An in person meeting please indicate so here!\\n1. Phone call')"), 'Phone call');
assert.equal(read("adminMeetingType_('If you would prefer a phone call or an in-person meeting at our North Raleigh office, please indicate so here!\\n2. In-person meeting')"), 'North Raleigh office');
assert.equal(read("adminMeetingType_('No special preference')"), 'Google video call');
assert.match(read("adminRangeStart_('week', new Date('2026-10-29T12:00:00Z'))"), /^2026-10-23$/);
assert.throws(() => read("adminVerifyToken_('bad')"), /sign in again/i);
console.log('Admin portal auth and meeting type checks passed');
