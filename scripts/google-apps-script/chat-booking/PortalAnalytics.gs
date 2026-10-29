// Private portal metrics, derived from the raw Event Log and saved lead records.
const PORTAL_ANALYTICS_VERSION = 'v3';
function portalCacheGet_(key) {
  const raw = CacheService.getScriptCache().get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}
function portalCachePut_(key, value, seconds) {
  const raw = JSON.stringify(value);
  if (raw.length < 90000) CacheService.getScriptCache().put(key, raw, seconds);
}
function adminAnalytics_(range) {
  const today = Utilities.formatDate(new Date(), CHAT_ZONE, 'yyyy-MM-dd');
  const key = 'portal-analytics-' + PORTAL_ANALYTICS_VERSION + '-' + today + '-' + range;
  const cached = portalCacheGet_(key);
  if (cached) return cached;
  const sheet = SpreadsheetApp.openById(ADMIN_ANALYTICS_SHEET_ID).getSheetByName('Event Log');
  if (!sheet) throw new Error('Raw website event log is unavailable.');
  const headers = sheet.getRange(1, 1, 1, 26).getDisplayValues()[0];
  if (headers[2] !== 'event_date' || headers[3] !== 'event_name' || headers[25] !== 'engaged_time_ms')
    throw new Error('Website tracking columns have changed.');
  const start = adminRangeStart_(range, new Date());
  const freshness = adminRangeStart_('week', new Date()), scanStart = start < freshness ? start : freshness;
  const totals = { sessions: {}, pageViews: {}, engagement: {}, enquiries: {}, bookingVisitors: {}, pages: {},
    daily: {}, chats: {}, chatBookings: {}, latestReal: '', oldestDate: '', scanned: 0, timingSamples: 0 };
  const last = sheet.getLastRow();
  // One Sheets API request reads only the ten required columns for each bounded chunk.
  // Browser queues can deliver older event dates after newer ones. Scan all bounded
  // chunks instead of assuming event_date is sorted and silently dropping late events.
  for (let row = 2; row <= last; row += 12000) {
    const end = Math.min(last, row + 11999);
    const response = Sheets.Spreadsheets.Values.batchGet(ADMIN_ANALYTICS_SHEET_ID, {
      ranges: ["'Event Log'!B" + row + ':H' + end, "'Event Log'!U" + row + ':U' + end, "'Event Log'!Y" + row + ':Z' + end],
      valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS'
    }).valueRanges || [];
    const base = response[0] && response[0].values || [], source = response[1] && response[1].values || [], timing = response[2] && response[2].values || [];
    for (let i = 0; i < base.length; i++) {
      const item = base[i], date = String(item[1] || '').slice(0, 10);
      if (!/^\d{4}-\d\d-\d\d$/.test(date)) continue;
      if (date < scanStart) continue;
      const event = String(item[2] || ''), session = String(item[3] || ''), pv = String(item[4] || ''), path = String(item[5] || ''), url = String(item[6] || '');
      if (!portalPublicLivingPage_(path, url) || /^diagnostic/.test(event)) continue;
      if (event === 'page_view' && String(item[0]) > totals.latestReal) totals.latestReal = String(item[0]);
      if (date < start || date > today || !session) continue;
      totals.oldestDate = !totals.oldestDate || date < totals.oldestDate ? date : totals.oldestDate;
      totals.scanned++;
      portalAccumulateEvent_(totals, { date: date, event: event, session: session, pv: pv, path: path,
        source: String((source[i] || [])[0] || ''), engaged: Number(String((timing[i] || [])[1] || '').replace(/,/g, '')) || 0 });
    }
  }
  const result = portalAnalyticsResult_(totals, range, start, today);
  const leads = portalLeadCount_(start, today);
  result.leads = leads.count; result.leadSources = leads.sources;
  result.leadNote = 'Unique email addresses across website forms, relocation-guide downloads, chat leads and consult bookings. Historical guide and booking records do not distinguish website visits from directly shared links.';
  portalCachePut_(key, result, 300);
  return result;
}
function portalPublicLivingPage_(path, url) {
  return path.charAt(0) === '/' && !/^\/(?:invest|calculator|admin)(?:\/|$)/.test(path) &&
    !/^\/learning-center\/review\//.test(path) && !/^\/raleigh-chat-preview-/.test(path) &&
    !/(?:localhost|127\.0\.0\.1)/i.test(url);
}
function portalAccumulateEvent_(totals, item) {
  const pageKey = item.session + ':' + item.pv;
  if (item.event === 'page_view') {
    totals.sessions[item.session] = true;
    const firstView = !totals.pageViews[pageKey];
    totals.pageViews[pageKey] = true;
    if (firstView) totals.pages[item.path] = (totals.pages[item.path] || 0) + 1;
    const day = totals.daily[item.date] || (totals.daily[item.date] = {}); day[item.session] = true;
    if (/^\/consult\//.test(item.path)) totals.bookingVisitors[item.session] = true;
  }
  if (item.pv && item.source === 'metrics_v2' && /^(?:engagement_heartbeat|page_exit)$/.test(item.event)) {
    totals.engagement[pageKey] = Math.max(totals.engagement[pageKey] || 0, Math.max(0, item.engaged));
    (totals.engagementSessions || (totals.engagementSessions = {}))[pageKey] = item.session;
    totals.timingSamples++;
  }
  if (/^(?:popup_submit_success|home_eval_submit_success|requested_contact_submit_success|new_construction_form_submit_success|suburb_quiz_submit_success|lead_submit_success|raleigh_suburb_quiz_submit)$/.test(item.event)) totals.enquiries[item.session] = true;
  if (/^chat:/.test(item.source)) {
    const id = item.source.slice(5);
    if (item.event === 'chat_conversation_started') totals.chats[id] = true;
    if (item.event === 'chat_appointment_booked') totals.chatBookings[id] = true;
  }
}
function portalAnalyticsResult_(totals, range, start, end) {
  const visits = Object.keys(totals.sessions).length, pageViews = Object.keys(totals.pageViews).length;
  const chats = Object.keys(totals.chats).length;
  const converted = Object.keys(totals.chats).filter(function (id) { return totals.chatBookings[id]; }).length;
  const measuredSessions = {};
  const engagedMs = Object.keys(totals.engagement).reduce(function (sum, id) {
    if (!totals.pageViews[id]) return sum;
    measuredSessions[totals.engagementSessions[id]] = true;
    return sum + totals.engagement[id];
  }, 0);
  const measuredVisits = Object.keys(measuredSessions).length;
  const series = [];
  for (let day = new Date(start + 'T12:00:00Z'); day <= new Date(end + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10); series.push({ date: date, visits: Object.keys(totals.daily[date] || {}).length });
  }
  return { range: range, start: start, end: end, visits: visits, pageViews: pageViews,
    averagePages: visits ? pageViews / visits : null,
    averageTimeSeconds: measuredVisits ? engagedMs / measuredVisits / 1000 : null, measuredTimeVisits: measuredVisits,
    timingNote: 'Visible-time measurement starts with this update. Earlier timing is excluded because background tabs could inflate it. Measured visits in this range: ' + measuredVisits + '.',
    enquiries: Object.keys(totals.enquiries).length, bookingVisitors: Object.keys(totals.bookingVisitors).length,
    chatConversations: chats, chatBooked: converted, chatConversion: chats ? converted / chats * 100 : null,
    chatNote: 'Chat metrics begin with this update; historical conversations are unavailable. Test chats are excluded. Conversion counts confirmed bookings from conversations started in this range.',
    topPages: Object.keys(totals.pages).sort(function (a, b) { return totals.pages[b] - totals.pages[a]; }).slice(0, 5).map(function (path) { return { path: path, views: totals.pages[path] }; }),
    series: series, latestReal: totals.latestReal, oldestDate: totals.oldestDate, scanned: totals.scanned,
    stale: !totals.latestReal || Date.now() - Date.parse(totals.latestReal) > 48 * 3600000,
    generatedAt: new Date().toISOString() };
}
function portalLeadCount_(start, end) {
  const book = SpreadsheetApp.openById(CHAT_LEAD_SPREADSHEET_ID), emails = {}, sources = {};
  const specs = [
    { tab: 'Website Direct Leads', date: 'Timestamp', email: 'Email', fallback: 'Home Eval Email', source: 'Source Page' },
    { tab: '2026 Relocation Guide - Kit', date: 'Timestamp', email: 'Email' },
    { tab: 'Website Chat Leads', date: 'Received', email: 'Email', source: 'Page' },
    { tab: 'Appointments Booked Directly', date: 'Logged At', email: 'Email' }
  ];
  specs.forEach(function (spec) {
    const sheet = book.getSheetByName(spec.tab);
    if (!sheet) throw new Error('Lead source is unavailable: ' + spec.tab);
    const rows = sheet.getDataRange().getValues(), headers = rows.shift() || [];
    const dateIndex = headers.indexOf(spec.date), emailIndex = headers.indexOf(spec.email), fallback = headers.indexOf(spec.fallback), sourceIndex = headers.indexOf(spec.source);
    if (dateIndex < 0 || emailIndex < 0) throw new Error('Lead columns changed: ' + spec.tab);
    const unique = {};
    rows.forEach(function (row) {
      const value = row[dateIndex];
      const parsed = value instanceof Date ? value : new Date(String(value || ''));
      if (!Number.isFinite(parsed.getTime())) return;
      const date = Utilities.formatDate(parsed, CHAT_ZONE, 'yyyy-MM-dd');
      const source = sourceIndex >= 0 ? String(row[sourceIndex] || '') : '';
      if (date < start || date > end || /(?:localhost|127\.0\.0\.1|\/invest\/|\/calculator\/|\/admin\/|raleigh-chat-preview-)/i.test(source)) return;
      const email = String(row[emailIndex] || (fallback >= 0 ? row[fallback] : '') || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      emails[email] = true; unique[email] = true;
    });
    sources[spec.tab] = Object.keys(unique).length;
  });
  return { count: Object.keys(emails).length, sources: sources };
}
