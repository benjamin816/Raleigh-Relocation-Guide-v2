/**
 * Living in Raleigh lead sync for Sender.net.
 * Add SENDER_API_TOKEN in Apps Script Project Settings > Script Properties.
 * The investor lead spreadsheet is deliberately never opened here.
 */
const LIVING_SENDER_SPREADSHEET_ID = '1V-4tnKUm22SXO9qTkBpC027gUU1eY_YwS6M2BplU8Uo';
const LIVING_SENDER_GROUP_ID = 'dJ2y5D';
const LIVING_SENDER_API_URL = 'https://api.sender.net/v2';
const LIVING_SENDER_MAX_ROWS_PER_RUN = 20;
const LIVING_SENDER_SOURCES = [
  { name: 'Website Direct Leads', email: 'Email', first: 'First Name', last: 'Last Name', phone: 'Phone' },
  { name: '2026 Relocation Guide - Kit', email: 'Email', first: 'First Name', last: 'Last Name' },
  { name: 'Appointments Booked Directly', email: 'Email', first: 'First Name', last: 'Last Name', phone: 'Phone' },
  { name: 'Website Chat Leads', email: 'Email', first: 'First name', last: 'Last name', phone: 'Phone' },
  { name: 'Chat Appointments', email: 'Email', full: 'Name', phone: 'Phone', optional: true }
];

function livingSenderSyncLeads() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { ok: false, reason: 'Another sync is running.' };
  try {
    livingSenderToken_(); // Fail before opening the lead sheet if setup is incomplete.
    const spreadsheet = SpreadsheetApp.openById(LIVING_SENDER_SPREADSHEET_ID);
    const properties = PropertiesService.getScriptProperties();
    const totals = { ok: true, scanned: 0, created: 0, added: 0, skipped: 0, suppressed: 0, errors: 0, sources: {} };
    for (const source of LIVING_SENDER_SOURCES) {
      const sheet = spreadsheet.getSheetByName(source.name);
      if (!sheet && source.optional) continue;
      if (!sheet) throw new Error('Missing Living lead tab: ' + source.name);
      const result = livingSenderSyncSheet_(sheet, source, properties);
      totals.sources[source.name] = result;
      for (const key of ['scanned', 'created', 'added', 'skipped', 'suppressed', 'errors']) totals[key] += result[key];
    }
    Logger.log(JSON.stringify(totals)); // Counts only; never log contact details or token.
    return totals;
  } finally {
    lock.releaseLock();
  }
}

function livingSenderSyncSheet_(sheet, source, properties) {
  const result = { scanned: 0, created: 0, added: 0, skipped: 0, suppressed: 0, errors: 0 };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(value => String(value || '').trim().toLowerCase());
  const index = name => headers.indexOf(String(name || '').toLowerCase());
  const emailColumn = index(source.email);
  if (emailColumn < 0) throw new Error('Email column missing from ' + source.name);
  const cursorKey = 'LIVING_SENDER_CURSOR_' + source.name.replace(/[^A-Za-z0-9]/g, '_');
  const start = Math.max(2, Number(properties.getProperty(cursorKey)) || 2);
  if (start > lastRow) return result;
  const count = Math.min(LIVING_SENDER_MAX_ROWS_PER_RUN, lastRow - start + 1);
  const rows = sheet.getRange(start, 1, count, sheet.getLastColumn()).getValues();
  const firstColumn = index(source.first);
  const lastColumn = index(source.last);
  const fullColumn = index(source.full);
  const phoneColumn = index(source.phone);
  const sourceColumn = index('Source Page');
  const leadTypeColumn = index('Lead Type');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = String(row[emailColumn] || '').trim().toLowerCase();
    const sourcePage = sourceColumn < 0 ? '' : String(row[sourceColumn] || '').toLowerCase();
    const leadType = leadTypeColumn < 0 ? '' : String(row[leadTypeColumn] || '').toLowerCase();
    result.scanned++;
    if (!livingSenderValidEmail_(email) || /(?:127\.0\.0\.1|localhost|\/invest\/|\/calculator\/)/.test(sourcePage) || /invest/.test(leadType)) {
      result.skipped++;
      properties.setProperty(cursorKey, String(start + i + 1));
      continue;
    }
    try {
      const fullName = fullColumn < 0 ? '' : String(row[fullColumn] || '').trim();
      const splitName = fullName.split(/\s+/).filter(Boolean);
      const contact = {
        email: email,
        firstname: firstColumn < 0 ? splitName[0] || '' : String(row[firstColumn] || '').trim(),
        lastname: lastColumn < 0 ? splitName.slice(1).join(' ') : String(row[lastColumn] || '').trim(),
        phone: phoneColumn < 0 ? '' : livingSenderPhone_(row[phoneColumn])
      };
      const outcome = livingSenderUpsert_(contact);
      result[outcome]++;
      properties.setProperty(cursorKey, String(start + i + 1));
    } catch (error) {
      result.errors++;
      // Leave the failed row as the next cursor so the next run retries it.
      Logger.log('Sender sync stopped: ' + source.name + ' row ' + (start + i) + ': ' + String(error.message || error).slice(0, 200));
      break;
    }
  }
  return result;
}

function livingSenderUpsert_(contact) {
  const path = '/subscribers/' + encodeURIComponent(contact.email);
  const lookup = livingSenderRequest_('get', path);
  if (lookup.code === 404) {
    const payload = {
      email: contact.email,
      firstname: contact.firstname,
      lastname: contact.lastname,
      groups: [LIVING_SENDER_GROUP_ID],
      trigger_automation: false
    };
    if (contact.phone) payload.phone = contact.phone;
    const created = livingSenderRequest_('post', '/subscribers', payload);
    livingSenderRequireSuccess_(created, 'create subscriber');
    return 'created';
  }
  livingSenderRequireSuccess_(lookup, 'look up subscriber');
  const data = lookup.body && lookup.body.data || {};
  const emailStatus = String(data.status && data.status.email || '').toLowerCase();
  if (emailStatus !== 'active') return 'suppressed';
  const memberships = (data.subscriber_tags || data.groups || []).map(group =>
    typeof group === 'string' ? group : String(group.id || group.tag_id || group.group_id || ''));
  if (memberships.indexOf(LIVING_SENDER_GROUP_ID) >= 0) return 'skipped';
  const added = livingSenderRequest_('post', '/subscribers/groups/' + LIVING_SENDER_GROUP_ID,
    { subscribers: [contact.email], trigger_automation: false });
  livingSenderRequireSuccess_(added, 'add subscriber to Living group');
  return 'added';
}

function livingSenderRequest_(method, path, payload) {
  const options = {
    method: method,
    headers: { Authorization: 'Bearer ' + livingSenderToken_(), Accept: 'application/json' },
    muteHttpExceptions: true
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  const response = UrlFetchApp.fetch(LIVING_SENDER_API_URL + path, options);
  const text = response.getContentText();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch (_) { /* HTTP status still governs. */ }
  return { code: response.getResponseCode(), body: body };
}

function livingSenderRequireSuccess_(result, operation) {
  if (result.code < 200 || result.code >= 300) {
    throw new Error(operation + ' failed with HTTP ' + result.code + ' (' +
      String(result.body && result.body.message || 'no message').slice(0, 120) + ')');
  }
}

function livingSenderToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('SENDER_API_TOKEN');
  if (!token) throw new Error('Set SENDER_API_TOKEN in Script Properties before syncing.');
  return token;
}

function livingSenderValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function livingSenderPhone_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return '';
}
