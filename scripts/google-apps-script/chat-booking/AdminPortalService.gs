/** Private admin operations. Never add these methods to the public booking bridge
 * without the Google ID token check in adminPortalRequest(). */
const ADMIN_ALLOWED_EMAILS = [
  'benjamin.raleighrealtor@gmail.com',
  'ricardo@triangleexperts.com'
];
const ADMIN_ANALYTICS_SHEET_ID = '1onTitTejjU9UxZP6TW5pFj0TFdFq0cewPPIS52cieRE';
const ADMIN_PRECALL_TAB = 'Appointments Booked Directly';

function adminPortalConfig() {
  return { clientId: PropertiesService.getScriptProperties().getProperty('ADMIN_GOOGLE_CLIENT_ID') || '' };
}

function adminVerifyToken_(credential) {
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
  const viewer = adminVerifyToken_(credential);
  const data = payload && typeof payload === 'object' ? payload : {};
  switch (String(action || '')) {
    case 'session': return { viewer: viewer };
    case 'appointments': return adminUpcoming_();
    case 'analytics': return adminAnalytics_(String(data.range || 'today'));
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

function adminMeetingType_(description) {
  const text = String(description || '');
  const question = /If you would prefer[^\n]*(?:phone call|in.person meeting)[^\n]*\n([^\n]*)/i.exec(text);
  const answer = String(question ? question[1] : '').trim();
  if (/^(?:1\b|phone\b|call\b)/i.test(answer)) return 'Phone call';
  if (/^(?:2\b|in.person\b|office\b)/i.test(answer)) return 'North Raleigh office';
  return 'Google video call';
}

function adminBookingDetails_(event) {
  const description = String(event.getDescription() || '');
  const name = /Booked by:\s*\n([^\n]+)/i.exec(description);
  const note = /Please include any information you would like me to know before our meeting!\s*\n([^\n]*)/i.exec(description);
  const purpose = /Please indicate whether you are looking to buy, sell, or invest in Raleigh\s*\n([^\n]*)/i.exec(description);
  const bookedLines = /Booked by:\s*\n([^\n]*)\n([^\n]*)\n([^\n]*)/i.exec(description);
  return { client: name ? name[1].trim() : event.getTitle().replace(/^.*?\((.*)\).*$/, '$1'),
    email: bookedLines ? bookedLines[2].trim() : '',
    type: adminMeetingType_(description), notes: note && note[1] !== 'Optional' ? note[1] : '',
    purpose: purpose ? purpose[1] : '', phone: bookedLines ? bookedLines[3].trim() : '' };
}

function adminUpcoming_() {
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
      const guests = event.getGuestList().map(function (guest) { return guest.getEmail(); });
      return { id: id, start: event.getStartTime().toISOString(), end: event.getEndTime().toISOString(),
        title: event.getTitle(), client: details.client, type: details.type, notes: details.notes,
        purpose: details.purpose, host: row[4] || 'Unassigned', hostEmail: row[5] || '',
        email: tracked.email || details.email, phone: tracked.phone || details.phone,
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
  return { appointments: appointments, counts: counts, nextUp: next, month: month };
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
      if (!wanted && present) event.removeGuest(host.inviteEmail);
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
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function adminRangeStart_(range, today) {
  const spans = { today: 1, week: 7, month: 30, quarter: 90, six: 183, nine: 274, year: 365 };
  if (!spans[range]) throw new Error('Unknown analytics period.');
  const date = new Date(today.getTime() - (spans[range] - 1) * 86400000);
  return Utilities.formatDate(date, CHAT_ZONE, 'yyyy-MM-dd');
}

function adminAnalytics_(range) {
  const book = SpreadsheetApp.openById(ADMIN_ANALYTICS_SHEET_ID);
  const sheet = book.getSheetByName('Event Log');
  if (!sheet) throw new Error('Raw website event log is unavailable.');
  const today = new Date();
  const start = adminRangeStart_(range, today);
  const end = Utilities.formatDate(today, CHAT_ZONE, 'yyyy-MM-dd');
  const freshnessStart = adminRangeStart_('week', today);
  const scanStart = start < freshnessStart ? start : freshnessStart;
  const sessions = {}, enquiries = {}, bookingVisitors = {}, pages = {}, daily = {};
  let latestReal = '', scanned = 0;
  const last = sheet.getLastRow();
  for (let row = 2; row <= last; row += 3000) {
    const count = Math.min(3000, last - row + 1);
    const values = sheet.getRange(row, 2, count, 7).getDisplayValues();
    for (let i = 0; i < values.length; i++) {
      const item = values[i];
      const date = String(item[1]).slice(0, 10);
      if (!/^\d{4}-\d\d-\d\d$/.test(date)) continue;
      if (date < scanStart) return adminAnalyticsResult_(range, start, end, sessions, enquiries, bookingVisitors, pages, daily, latestReal, scanned);
      const event = String(item[2]);
      const session = String(item[3]);
      const path = String(item[5]);
      const url = String(item[6]);
      if (!path.startsWith('/') || path.startsWith('/invest/') || path.startsWith('/calculator/') ||
          path.startsWith('/learning-center/review/') || /(?:localhost|127\.0\.0\.1)/i.test(url)) continue;
      if (event === 'page_view' && !latestReal) latestReal = String(item[0]);
      if (date < start || date > end || !session) continue;
      scanned++;
      if (event === 'page_view') {
        sessions[session] = true;
        if (path.startsWith('/consult/')) bookingVisitors[session] = true;
        pages[path] = (pages[path] || 0) + 1;
        daily[date] = daily[date] || {};
        daily[date][session] = true;
      }
      if (/^(?:popup_submit_success|home_eval_submit_success|requested_contact_submit_success|new_construction_form_submit_success|suburb_quiz_submit_success)$/.test(event))
        enquiries[session] = true;
    }
  }
  return adminAnalyticsResult_(range, start, end, sessions, enquiries, bookingVisitors, pages, daily, latestReal, scanned);
}

function adminAnalyticsResult_(range, start, end, sessions, enquiries, bookingVisitors, pages, daily, latestReal, scanned) {
  const series = [];
  for (let day = new Date(start + 'T12:00:00Z'); day <= new Date(end + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    series.push({ date: date, visits: daily[date] ? Object.keys(daily[date]).length : 0 });
  }
  const topPages = Object.keys(pages).sort(function (a, b) { return pages[b] - pages[a]; }).slice(0, 5)
    .map(function (path) { return { path: path, views: pages[path] }; });
  const stale = !latestReal || !Number.isFinite(Date.parse(latestReal)) ||
    Date.now() - Date.parse(latestReal) > 48 * 3600000;
  return { range: range, start: start, end: end, visits: Object.keys(sessions).length,
    enquiries: Object.keys(enquiries).length, bookingVisitors: Object.keys(bookingVisitors).length,
    topPages: topPages, series: series, latestReal: latestReal, stale: stale, scanned: scanned };
}

/** Check the live calendar and analytics sources without logging lead details. */
function adminPortalSmoke() {
  const analytics = adminAnalytics_('today');
  const upcoming = adminUpcoming_();
  console.log(JSON.stringify({ visits: analytics.visits, stale: analytics.stale,
    appointments: upcoming.appointments.length, nextUp: upcoming.nextUp }));
}
