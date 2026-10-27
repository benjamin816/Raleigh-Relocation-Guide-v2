const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync(__dirname + '/LivingSenderSync.gs', 'utf8');
const properties = new Map([['SENDER_API_TOKEN', 'test-token']]);
const calls = [];
const sheet = {
  getName: () => 'Website Direct Leads',
  getLastRow: () => 4,
  getLastColumn: () => 7,
  getRange: (row, column, count) => ({ getValues: () => row === 1
    ? [['Email', 'First Name', 'Last Name', 'Phone', 'Source Page', 'Lead Type', 'Unused']]
    : [
      ['living@example.com', 'Living', 'Lead', '9195551212', '/quiz/', 'buyer', ''],
      ['investor@example.com', 'Investor', 'Lead', '', '/invest/', 'investor', ''],
      ['suppressed@example.com', 'Suppressed', 'Lead', '', '/sell/', 'seller', '']
    ].slice(row - 2, row - 2 + count) })
};
const context = {
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: key => properties.get(key),
    setProperty: (key, value) => properties.set(key, value)
  }) },
  UrlFetchApp: { fetch: (url, options) => {
    calls.push({ url, options });
    const suppressed = url.includes('suppressed%40example.com');
    const lookup = options.method === 'get';
    return {
      getResponseCode: () => lookup ? (suppressed ? 200 : 404) : 201,
      getContentText: () => lookup && suppressed
        ? JSON.stringify({ data: { status: { email: 'unsubscribed' } } })
        : '{}'
    };
  } },
  Logger: { log: () => {} }
};
vm.createContext(context);
vm.runInContext(script, context);
const result = context.livingSenderSyncSheet_(sheet, {
  name: 'Website Direct Leads', email: 'Email', first: 'First Name', last: 'Last Name', phone: 'Phone'
}, context.PropertiesService.getScriptProperties());
assert.equal(result.created, 1);
assert.equal(result.skipped, 1);
assert.equal(result.suppressed, 1);
assert.equal(calls.some(call => call.url.includes('investor%40example.com')), false);
assert.equal(calls.some(call => call.options.payload && call.options.payload.includes('suppressed@example.com')), false);
assert.equal(properties.get('LIVING_SENDER_CURSOR_Website_Direct_Leads'), '5');
console.log('Living Sender sync checks passed');
