/** Private admin operations. Never add these methods to the public booking bridge
 * without the Google ID token check in adminPortalRequest(). */
const ADMIN_ALLOWED_EMAILS = [
  'benjamin.carver@exprealty.com',
  'benjamin.raleighrealtor@gmail.com',
  'ricardo@triangleexperts.com'
];
const ADMIN_ANALYTICS_SHEET_ID = '1onTitTejjU9UxZP6TW5pFj0TFdFq0cewPPIS52cieRE';
const ADMIN_PRECALL_TAB = 'Appointments Booked Directly';

function adminPortalConfig() {
  return { clientId: PropertiesService.getScriptProperties().getProperty('ADMIN_GOOGLE_CLIENT_ID') || '' };
}

function adminVerifyRelay_(credential, action, data) {
  const parts = credential.split('.');
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_ASSERTION_KEY');
  if (!key || parts.length !== 3 || parts[0] !== 'v1' || credential.length > 20000) throw new Error('Please sign in again.');
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[1], key)).replace(/=+$/, '');
  let difference = expected.length ^ parts[2].length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (parts[2].charCodeAt(i) || 0);
  if (difference) throw new Error('Invalid portal authorization.');
  const claim = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  const now = Math.floor(Date.now() / 1000);
  if (!ADMIN_ALLOWED_EMAILS.includes(claim.email) || claim.expires <= now || claim.expires > now + 90 ||
      claim.action !== action || JSON.stringify(claim.data) !== JSON.stringify(data) || !/^[a-f0-9-]{36}$/.test(claim.nonce))
    throw new Error('Portal authorization expired or does not match this request.');
  const cache = CacheService.getScriptCache(), nonceKey = 'admin-relay-' + claim.nonce;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (cache.get(nonceKey)) throw new Error('Portal request was already used. Please retry.');
    cache.put(nonceKey, 'used', 120);
  } finally { lock.releaseLock(); }
  return { email: claim.email, name: claim.name };
}

function adminVerifyToken_(credential, action, data) {
  if (String(credential || '').indexOf('v1.') === 0) return adminVerifyRelay_(credential, action, data);
  const clientId = adminPortalConfig().clientId;
  if (!clientId) throw new Error('Google sign-in is not configured.');
  const token = String(credential || '');
  if (!/^[A-Za-z0-9._-]{100,4096}$/.test(token)) throw new Error('Please sign in again.');
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Your sign-in has expired. Please sign in again.');
  const info = JSON.parse(response.getContentText());
  const email = String(info.email || '').toLowerCase();
  if (info.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss) ||
      Number(info.exp) <= Date.now() / 1000 || String(info.email_verified) !== 'true' ||
      !ADMIN_ALLOWED_EMAILS.includes(email)) throw new Error('This Google account is not authorized for the portal.');
  return { email: email, name: String(info.name || email.split('@')[0]) };
}

function adminPortalRequest(credential, action, payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const viewer = adminVerifyToken_(credential, action, data);
  switch (String(action || '')) {
    case 'session': return { viewer: viewer };
    case 'appointments': return adminUpcoming_();
    case 'analytics': return adminAnalytics_(String(data.range || 'today'));
    case 'book': return bookAppointment_(data, true);
    case 'assignment': return adminChangeAssignment_(data, viewer);
    case 'cancel': return adminCancelAppointment_(data, viewer);
    default: throw new Error('Unknown admin action.');
  }
}

function adminAssignmentIndex_() {
  const ledger = chatAssignmentRows_();
  const byId = {};
  ledger.rows.forEach(function (row) { byId[String(row[0])] = row; });
  return { sheet: ledger.sheet, byId: byId };
}

function adminPrecallIndex_() {
  const sheet = SpreadsheetApp.openById(CHAT_LEAD_SPREADSHEET_ID).getSheetByName(ADMIN_PRECALL_TAB);
  if (!sheet) throw new Error('The pre-call email tracking tab is unavailable.');
  const headers = sheet.getRange(1, 1, 1, 12).getDisplayValues()[0];
  if (headers[10] !== 'Event ID' || headers[11] !== 'Status') throw new Error('Pre-call email tracking columns changed.');
  const byId = {};
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, 12).getDisplayValues().forEach(function (row) {
    if (row[10]) byId[row[10]] = { status: row[11], phone: row[7], email: row[6],
      preference: row[8], notes: row[9] };
  });
  return byId;
}

function adminDescriptionSections_(description) {
  const text = String(description || '').replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\*\*/g, '')
    .replace(/\\([.])/g, '$1').replace(/\r/g, '');
  const headings = /Booked\s+by\s*:?[ \t]*|If\s+you\s+would\s+prefer[\s\S]*?Please\s+indicate\s+so\s+here!?|Please\s+include\s+any\s+information[\s\S]*?before\s+our\s+meeting!?|Please\s+indicate\s+whether[\s\S]*?invest\s+in\s+Raleigh|I['’]m\s+looking\s+forward\s+to\s+meeting\s+you/gi;
  const matches = []; let match;
  while ((match = headings.exec(text))) matches.push({ label: match[0], start: match.index, end: headings.lastIndex });
  const result = {};
  matches.forEach(function (heading, index) {
    heading.label = heading.label.replace(/\s+/g, ' ');
    const key = /^Booked/i.test(heading.label) ? 'contact' : /^If you/i.test(heading.label) ? 'preference' :
      /^Please include/i.test(heading.label) ? 'notes' : /^Please indicate/i.test(heading.label) ? 'purpose' : '';
    if (key) result[key] = text.slice(heading.end, matches[index + 1] ? matches[index + 1].start : text.length).trim();
  });
  return result;
}

function adminMeetingType_(description) {
  const answer = String(adminDescriptionSections_(description).preference || '').trim();
  if (/^(?:1\b|phone\b|call\b)/i.test(answer)) return 'Phone call';
  if (/^(?:2\b|in.person\b|office\b)/i.test(answer)) return 'North Raleigh office';
  return 'Google video call';
}

function adminBookingDetails_(event) {
  const description = String(event.getDescription() || ''), sections = adminDescriptionSections_(description);
  const contact = sections.contact || '';
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(contact);
  const phone = /\+?\d[\d\s().-]{8,}\d/.exec(email ? contact.slice(email.index + email[0].length) : contact);
  const name = email ? contact.slice(0, email.index).replace(/\[|\]|mailto:|\(/g, '').trim() : '';
  return { client: name || event.getTitle().replace(/^.*?\((.*)\).*$/, '$1'), email: email ? email[0] : '',
    type: adminMeetingType_(description), notes: /^(?:Optional|Not provided)$/i.test(sections.notes || '') ? '' : sections.notes || '',
    purpose: sections.purpose || '', phone: phone ? phone[0].trim() : '' };
}

function adminEventLinks_(event, type) {
  try {
    const items = Calendar.Events.list(CHAT_CALENDAR_ID, { iCalUID: event.getId(), maxResults: 2 }).items || [];
    const item = items[0] || {};
    const entries = item.conferenceData && item.conferenceData.entryPoints || [];
    const video = item.hangoutLink || (entries.find(function (entry) { return entry.entryPointType === 'video'; }) || {}).uri || '';
    return { calendarUrl: item.htmlLink || '', videoUrl: type === 'Google video call' && /^https:\/\//i.test(video) ? video : '' };
  } catch (error) {
    console.warn('Calendar meeting link lookup failed: ' + error.message);
    return { calendarUrl: '', videoUrl: '' };
  }
}

function adminUpcoming_() {
  const cached = portalCacheGet_('portal-appointments-v2');
  if (cached) return cached;
  const now = new Date();
  const end = new Date(now.getTime() + 90 * 86400000);
  const assignments = adminAssignmentIndex_().byId;
  const emailStatus = adminPrecallIndex_();
  const appointments = chatCalendar_(CHAT_CALENDAR_ID).getEvents(now, end)
    .filter(function (event) { return /^Exploration Call: Living in Raleigh Team/i.test(event.getTitle()); })
    .sort(function (a, b) { return a.getStartTime() - b.getStartTime(); })
    .map(function (event) {
      const id = event.getId();
      const row = assignments[id] || [];
      const details = adminBookingDetails_(event);
      const tracked = emailStatus[id] || {};
      const links = adminEventLinks_(event, details.type);
      const guests = event.getGuestList().map(function (guest) { return guest.getEmail(); });
      const actualHosts = CHAT_HOSTS.filter(function (host) {
        return [host.inviteEmail].concat(host.calendars).some(function (email) { return guests.some(function (guest) { return guest.toLowerCase() === email.toLowerCase(); }); });
      });
      const actualName = actualHosts.length === 2 ? 'Both' : actualHosts.length === 1 ? actualHosts[0].name : '';
      if (actualName && row.length && (row[4] !== actualName)) {
        const ledger = chatAssignmentRows_();
        const position = ledger.rows.findIndex(function (entry) { return String(entry[0]) === id; });
        if (position >= 0) ledger.sheet.getRange(position + 2, 5, 1, 5).setValues([[actualName,
          actualHosts.map(function (host) { return host.inviteEmail; }).join(','), 'Manual attendee change', 'Assigned', new Date()]]);
        row[4] = actualName;
      }
      return { id: id, start: event.getStartTime().toISOString(), end: event.getEndTime().toISOString(),
        title: event.getTitle(), client: details.client, type: details.type, notes: details.notes,
        purpose: details.purpose, host: actualName || row[4] || 'Unassigned', hostEmail: row[5] || '',
        email: details.email || tracked.email, phone: details.phone || tracked.phone,
        videoUrl: links.videoUrl, calendarUrl: links.calendarUrl,
        emailStatus: tracked.status || 'Not yet logged', guests: guests };
    });
  const counts = { Benjamin: 0, Ricardo: 0 };
  const month = Utilities.formatDate(now, CHAT_ZONE, 'yyyy-MM');
  Object.keys(assignments).forEach(function (id) {
    const row = assignments[id];
    const callMonth = row[2] instanceof Date ? Utilities.formatDate(row[2], CHAT_ZONE, 'yyyy-MM') : String(row[2]).slice(0, 7);
    if (row[7] !== 'Assigned' || callMonth !== month) return;
    if (row[4] === 'Benjamin' || row[4] === 'Both') counts.Benjamin++;
    if (row[4] === 'Ricardo' || row[4] === 'Both') counts.Ricardo++;
  });
  const next = chatPickHost_(CHAT_HOSTS, Object.keys(assignments).map(function (id) { return assignments[id]; }), '').host.name;
  const result = { appointments: appointments, counts: counts, nextUp: next, month: month, generatedAt: new Date().toISOString() };
  portalCachePut_('portal-appointments-v2', result, 20);
  return result;
}

function adminFindEvent_(id) {
  const value = String(id || '');
  if (!/^[A-Za-z0-9._@-]{10,180}$/.test(value)) throw new Error('Invalid appointment.');
  const event = chatCalendar_(CHAT_CALENDAR_ID).getEventById(value);
  if (!event || !/^Exploration Call: Living in Raleigh Team/i.test(event.getTitle()) ||
      event.getStartTime().getTime() <= Date.now()) throw new Error('This upcoming appointment is no longer available.');
  return event;
}

function adminHostConflict_(event, target) {
  const start = event.getStartTime();
  const end = event.getEndTime();
  return CHAT_HOSTS.filter(function (host) { return target === 'Both' || target === host.name; })
    .some(function (host) {
      return host.calendars.some(function (calendarId) {
        return chatBusyEvents_(calendarId, start, end, true).some(function (busy) {
          return busy.getId() !== event.getId();
        });
      });
    });
}

function adminChangeAssignment_(data, viewer) {
  const target = String(data.host || '');
  if (!['Benjamin', 'Ricardo', 'Both'].includes(target) || data.confirm !== true)
    throw new Error('Confirm the assignment change.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const event = adminFindEvent_(data.id);
    const index = adminAssignmentIndex_();
    const row = index.byId[event.getId()];
    if (!row || row[7] !== 'Assigned') throw new Error('The appointment assignment needs manual review.');
    if (row[4] !== String(data.expectedHost || '')) throw new Error('Assignment changed. Refresh before trying again.');
    if (adminHostConflict_(event, target)) throw new Error('That host has a conflicting calendar event. Choose another assignment.');
    const currentGuests = event.getGuestList().map(function (guest) { return guest.getEmail().toLowerCase(); });
    CHAT_HOSTS.forEach(function (host) {
      const wanted = target === 'Both' || target === host.name;
      const present = currentGuests.includes(host.inviteEmail.toLowerCase());
      if (wanted && !present) event.addGuest(host.inviteEmail);
      if (!wanted) [host.inviteEmail].concat(host.calendars).forEach(function (email) {
        if (currentGuests.includes(email.toLowerCase())) event.removeGuest(email);
      });
    });
    event.setTag('RR_ASSIGNED_HOST', target);
    const sheet = index.sheet;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
    const position = rows.findIndex(function (entry) { return String(entry[0]) === event.getId(); });
    if (position < 0) throw new Error('Assignment row was not found.');
    const emails = CHAT_HOSTS.filter(function (host) { return target === 'Both' || target === host.name; })
      .map(function (host) { return host.inviteEmail; }).join(',');
    sheet.getRange(position + 2, 5, 1, 5).setValues([[target, emails,
      'Admin transfer by ' + viewer.email, 'Assigned', Utilities.formatDate(new Date(), CHAT_ZONE, 'yyyy-MM-dd HH:mm')]]);
    CacheService.getScriptCache().remove('portal-appointments-v2');
    return { ok: true, host: target };
  } finally { lock.releaseLock(); }
}

function adminCancelAppointment_(data, viewer) {
  if (data.confirm !== true || data.confirmText !== 'CANCEL') throw new Error('Type CANCEL to confirm.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const event = adminFindEvent_(data.id);
    const id = event.getId();
    event.deleteEvent();
    const index = adminAssignmentIndex_();
    const rows = index.sheet.getRange(2, 1, index.sheet.getLastRow() - 1, 11).getValues();
    const position = rows.findIndex(function (row) { return String(row[0]) === id; });
    if (position >= 0) {
      index.sheet.getRange(position + 2, 7).setValue('Cancelled by ' + viewer.email);
      index.sheet.getRange(position + 2, 8).setValue('Cancelled');
      index.sheet.getRange(position + 2, 9).setValue(Utilities.formatDate(new Date(), CHAT_ZONE, 'yyyy-MM-dd HH:mm'));
    }
    CacheService.getScriptCache().remove('portal-appointments-v2');
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function adminRangeStart_(range, today) {
  const spans = { today: 1, week: 7, month: 30, quarter: 90, six: 183, nine: 274, year: 365 };
  if (!spans[range]) throw new Error('Unknown analytics period.');
  const date = new Date(today.getTime() - (spans[range] - 1) * 86400000);
  return Utilities.formatDate(date, CHAT_ZONE, 'yyyy-MM-dd');
}

/** Check the live calendar and analytics sources without logging lead details. */
function adminPortalSmoke() {
  const analytics = adminAnalytics_('today');
  const upcoming = adminUpcoming_();
  console.log(JSON.stringify({ visits: analytics.visits, stale: analytics.stale,
    appointments: upcoming.appointments.length, nextUp: upcoming.nextUp }));
}
