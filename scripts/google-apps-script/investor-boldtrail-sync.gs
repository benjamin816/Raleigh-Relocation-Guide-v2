// Add this file to the existing "LEAD SHEET to BoldTrail" Apps Script project.
// It reuses that project's BOLDTRAIL_API_KEY and contact/tag helper functions.
const INVESTOR_SYNC_SHEET_ID = '1S9Umd8a0-X5DKiSjnFuOD4ysyuskMZSft1bxolkYXpw';
const INVESTOR_SYNC_TAB = 'Investor Leads';
const INVESTOR_SYNC_HEADERS = [
  'Investor Newsletter Opt-In', 'Newsletter Opt-In At', 'BoldTrail Sync Status',
  'BoldTrail Contact ID', 'BoldTrail Synced At', 'BoldTrail Sync Error'
];

function syncInvestorLeadsToBoldTrail() {
  const apiToken = getBoldTrailApiKey_();
  if (!apiToken) throw new Error('BOLDTRAIL_API_KEY is not configured.');
  const sheet = SpreadsheetApp.openById(INVESTOR_SYNC_SHEET_ID).getSheetByName(INVESTOR_SYNC_TAB);
  if (!sheet) throw new Error('Investor Leads tab is missing.');
  const headers = sheet.getRange(1, 24, 1, 6).getValues()[0];
  if (headers.some(function (value, index) { return String(value).trim() !== INVESTOR_SYNC_HEADERS[index]; })) {
    throw new Error('Investor Leads columns X:AC do not match the expected CRM headers.');
  }
  const lastRow = sheet.getLastRow();
  let processed = 0;
  let synced = 0;
  let failed = 0;
  for (let rowNumber = 2; rowNumber <= lastRow && processed < 100; rowNumber++) {
    const row = sheet.getRange(rowNumber, 1, 1, 29).getValues()[0];
    const status = String(row[25] || '').trim().toLowerCase();
    if (status === 'synced' || status === 'skipped_no_email') continue;
    const email = String(row[5] || '').trim().toLowerCase();
    if (!email) {
      sheet.getRange(rowNumber, 26, 1, 4).setValues([['skipped_no_email', '', '', 'No email address provided.']]);
      continue;
    }
    processed++;
    try {
      const id = syncOneInvestorLead_(apiToken, row);
      sheet.getRange(rowNumber, 26, 1, 4).setValues([['synced', id, new Date(), '']]);
      synced++;
    } catch (error) {
      sheet.getRange(rowNumber, 26, 1, 4).setValues([[
        'failed', '', '', String(error && error.message || error).slice(0, 500)
      ]]);
      failed++;
    }
  }
  Logger.log('Investor leads: ' + processed + ' processed, ' + synced + ' synced, ' + failed + ' failed.');
  return { processed: processed, synced: synced, failed: failed };
}

function syncOneInvestorLead_(apiToken, row) {
  const email = String(row[5] || '').trim().toLowerCase();
  const newsletterOptIn = String(row[23] || '').trim().toLowerCase() === 'yes';
  let contacts = boldTrailFindContactsByEmail_(apiToken, email);
  if (!contacts.length) {
    const phone = String(row[6] || '').replace(/\D/g, '');
    const payload = {
      email: email,
      first_name: String(row[3] || '').trim(),
      last_name: String(row[4] || '').trim(),
      source: 'Raleigh Investor Calculator',
      status: 7,
      phone_on: 0,
      text_on: 0,
      email_optin: newsletterOptIn ? 1 : 0,
      external_vendor_id: String(row[2] || '').trim()
    };
    if (phone.length >= 10) payload.cell_phone_1 = phone;
    const created = boldTrailCreateContact_(apiToken, payload);
    delete boldTrailContactCache_[email];
    contacts = boldTrailFindContactsByEmail_(apiToken, email);
    if (!contacts.length && created && created.id) contacts = [created];
    if (!contacts.length && created && created.data && created.data.id) contacts = [created.data];
  }
  if (!contacts.length) throw new Error('BoldTrail contact ID could not be resolved.');
  const sourceTag = String(row[20] || '').trim().toLowerCase() === 'message'
    ? 'lead_source_calculator_message' : 'lead_source_calculator';
  contacts.forEach(function (contact) {
    const id = String(contact.id || '');
    if (!id) throw new Error('BoldTrail contact ID is missing.');
    boldTrailAddHashtag_(apiToken, id, 'investor');
    boldTrailAddHashtag_(apiToken, id, sourceTag);
    if (newsletterOptIn) {
      boldTrailAddHashtag_(apiToken, id, 'investor_newsletter');
    }
  });
  return String(contacts[0].id);
}
