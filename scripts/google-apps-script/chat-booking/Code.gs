/** Separate web app for the Living in Raleigh chat's calendar booking.
 * Deploy as the calendar owner, execute as me, accessible to anyone.
 * Set the Apps Script project timezone to America/New_York.
 * Set CHAT_BOOKING_WINDOWS in Script Properties to the existing /consult/
 * schedule's exact seven-day availability before enabling this service.
 */
const CHAT_CALENDAR_ID = 'livinginraleighteam@gmail.com';
const CHAT_TEAM_FREE_FROM = '2026-10-29T22:10:37Z';
const CHAT_TEAM_FREE_EXCLUDED = '0k0km3phn87a8g0m8f2pguhf3k'; // Existing Friday appointment: leave untouched.
// Keep these sources aligned with the live round-robin calendar script's RR.hosts.
const CHAT_HOSTS = [
  { name: 'Benjamin', inviteEmail: 'benjamin.carver@exprealty.com', calendars: [
    'benjamin.raleighrealtor@gmail.com', 'benjamindcarver@yahoo.com',
    'mrcarver.jr01@gmail.com'
  ] },
  { name: 'Ricardo', inviteEmail: 'ricardo@triangleexperts.com', calendars: [
    'ricardo.collier90@gmail.com', 'ricardo@triangleexperts.com'
  ] }
];
const CHAT_LEAD_SPREADSHEET_ID = '1V-4tnKUm22SXO9qTkBpC027gUU1eY_YwS6M2BplU8Uo';
const CHAT_LEAD_TAB = 'Chat Appointments';
const CHAT_ASSIGNMENT_TAB = 'Appointment Assignments';
const CHAT_ZONE = 'America/New_York';
const CHAT_MINUTES = 60;
const CHAT_ALLOWED_ORIGINS = [
  'https://www.raleighncguide.com',
  'https://raleighncguide.com',
  'http://127.0.0.1:8777'
];

function doGet(e) {
  const channel = String(e && e.parameter && e.parameter.channel || '');
  if (!/^[a-z0-9-]{16,80}$/i.test(channel)) throw new Error('Invalid channel.');
  const template = HtmlService.createTemplateFromFile('ChatBookingBridge');
  template.channel = channel;
  template.origins = CHAT_ALLOWED_ORIGINS;
  return template.evaluate().setTitle('Living in Raleigh booking bridge')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** JSON transport for the same booking operations used by the HTML bridge.
 * A relay can call this endpoint without the visitor's Google browser cookies.
 * Private admin actions still require an artifact-bound Google ID token. */
function doPost(e) {
  try {
    const raw = String(e && e.postData && e.postData.contents || '');
    if (raw.length > 30000) throw new Error('Request is too large.');
    const request = JSON.parse(raw);
    const args = request && request.args;
    if (!request || !Array.isArray(args) || args.length > 4) throw new Error('Invalid request.');
    const methods = {
      slots: getChatBookingSlots,
      check: checkChatBookingSlot,
      suggest: checkChatBookingSuggestion,
      book: bookChatAppointment,
      adminConfig: adminPortalConfig,
      admin: adminPortalRequest
    };
    const fn = methods[request.method];
    if (!fn) throw new Error('Unknown request.');
    return ContentService.createTextOutput(JSON.stringify({ ok: true, result: fn.apply(null, args) }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: error && error.message || 'Service unavailable.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function chatBookingWindows_() {
  if (Session.getScriptTimeZone() !== CHAT_ZONE) throw new Error('Booking timezone is not configured.');
  const raw = PropertiesService.getScriptProperties().getProperty('CHAT_BOOKING_WINDOWS');
  if (!raw) throw new Error('Chat booking availability is not configured.');
  const days = JSON.parse(raw);
  if (!Array.isArray(days) || days.length !== 7) throw new Error('Invalid booking availability.');
  days.forEach(function (windows) {
    if (!Array.isArray(windows)) throw new Error('Invalid booking day.');
    windows.forEach(function (period) {
      if (!Array.isArray(period) || period.length !== 2 ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(period[0]) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(period[1]) ||
          period[0] >= period[1]) throw new Error('Invalid booking period.');
    });
  });
  return days;
}

function chatCalendar_(id) {
  const calendar = CalendarApp.getCalendarById(id);
  if (!calendar) {
    console.error('Required calendar is unavailable: ' + id);
    throw new Error('Required calendar is unavailable.');
  }
  return calendar;
}

function chatSlotAllowed_(start, windows) {
  if (!(start instanceof Date) || isNaN(start.getTime())) return false;
  const now = Date.now();
  if (start.getTime() < now + 4 * 3600000 || start.getTime() > now + 60 * 86400000) return false;
  if (start.getMinutes() !== 0 || start.getSeconds() !== 0) return false;
  const end = new Date(start.getTime() + CHAT_MINUTES * 60000);
  const date = Utilities.formatDate(start, CHAT_ZONE, 'yyyy-MM-dd');
  const endDate = Utilities.formatDate(end, CHAT_ZONE, 'yyyy-MM-dd');
  if (date !== endDate) return false;
  const weekday = Number(Utilities.formatDate(start, CHAT_ZONE, 'u')) % 7;
  const beginClock = Utilities.formatDate(start, CHAT_ZONE, 'HH:mm');
  const endClock = Utilities.formatDate(end, CHAT_ZONE, 'HH:mm');
  return windows[weekday].some(function (period) {
    return beginClock >= period[0] && endClock <= period[1];
  });
}

function chatBusyEvents_(calendarId, start, end, ignoreMirrors, events) {
  return (events || chatCalendar_(calendarId).getEvents(start, end)).filter(function (event) {
    // Mirror artifacts are ignored only on a host's source calendar. On the
    // shared calendar they are real booking blocks and must match /consult/.
    if (ignoreMirrors && (event.getTag('MIRROR_BLOCK') === '1' || event.getTag('MIRROR_SOURCE'))) return false;
    try {
      if (event.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT) return false;
      if (event.getMyStatus() === CalendarApp.GuestStatus.NO) return false;
    } catch (_) { /* Unknown status is treated as busy. */ }
    return true;
  });
}

function chatBusyRanges_(calendarId, start, end, ignoreMirrors) {
  return chatBusyEvents_(calendarId, start, end, ignoreMirrors).map(function (event) {
    return [event.getStartTime().getTime(), event.getEndTime().getTime()];
  });
}

function chatRangeFree_(ranges, start, end) {
  const first = start.getTime();
  const last = end.getTime();
  return ranges.every(function (range) { return range[0] >= last || range[1] <= first; });
}

function chatAssignedBusy_(start, end, excludedId, events) {
  const result = { Benjamin: [], Ricardo: [] };
  (events || chatCalendar_(CHAT_CALENDAR_ID).getEvents(start, end)).forEach(function (event) {
    if (event.getId() === excludedId || !/^Exploration Call: Living in Raleigh Team/i.test(event.getTitle())) return;
    const guests = event.getGuestList().map(function (guest) { return guest.getEmail().toLowerCase(); });
    const tagged = event.getTag('RR_ASSIGNED_HOST');
    const matched = CHAT_HOSTS.filter(function (host) {
      return [host.inviteEmail].concat(host.calendars).some(function (email) { return guests.includes(email.toLowerCase()); });
    });
    // An invitation can be pending or marked Free on a host's copy. The actual
    // assignment still reserves that host; unknown assignments fail closed.
    CHAT_HOSTS.forEach(function (host) {
      const reserved = matched.length ? matched.some(function (item) { return item.name === host.name; }) :
        !tagged || tagged === 'Both' || tagged === host.name;
      if (reserved) result[host.name].push([event.getStartTime().getTime(), event.getEndTime().getTime()]);
    });
  });
  return result;
}

function chatSetTeamFree_(event) {
  if (!event || event.getId().replace(/@google\.com$/, '') === CHAT_TEAM_FREE_EXCLUDED ||
      event.getDateCreated() < new Date(CHAT_TEAM_FREE_FROM)) return;
  if (event.getTransparency() !== CalendarApp.EventTransparency.TRANSPARENT)
    event.setTransparency(CalendarApp.EventTransparency.TRANSPARENT);
}

function chatAvailableHosts_(start, end) {
  const assigned = chatAssignedBusy_(start, end);
  return CHAT_HOSTS.filter(function (host) {
    return chatRangeFree_(assigned[host.name], start, end) && host.calendars.every(function (id) {
      return chatBusyEvents_(id, start, end, true).length === 0;
    });
  });
}

function chatSlotFree_(start, windows) {
  if (!chatSlotAllowed_(start, windows)) return false;
  const end = new Date(start.getTime() + CHAT_MINUTES * 60000);
  if (chatBusyEvents_(CHAT_CALENDAR_ID, start, end, false).length > 0) return false;
  return chatAvailableHosts_(start, end).length > 0;
}

function chatBookingPreference_(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const host = /^(Benjamin|Ricardo)$/i.test(String(raw.host || ''))
    ? String(raw.host).toLowerCase() === 'benjamin' ? 'Benjamin' : 'Ricardo' : '';
  const daypart = /^(morning|afternoon|evening|midday)$/i.test(String(raw.daypart || ''))
    ? String(raw.daypart).toLowerCase() : '';
  const weekdays = Array.isArray(raw.weekdays) ? raw.weekdays.filter(function (day) {
    return Number.isInteger(day) && day >= 0 && day <= 6;
  }) : [];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date || '')) ? String(raw.date) : '';
  return { host: host, daypart: daypart, weekdays: weekdays, date: date };
}

function chatDaypart_(start) {
  const hour = Number(Utilities.formatDate(start, CHAT_ZONE, 'H'));
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

function chatDaypartMatches_(start, daypart) {
  if (!daypart) return true;
  const hour = Number(Utilities.formatDate(start, CHAT_ZONE, 'H'));
  return daypart === 'midday' ? hour >= 11 && hour < 15 : chatDaypart_(start) === daypart;
}

function chatSlotMatches_(start, preference) {
  if (preference.date && Utilities.formatDate(start, CHAT_ZONE, 'yyyy-MM-dd') !== preference.date) return false;
  const weekday = Number(Utilities.formatDate(start, CHAT_ZONE, 'u')) % 7;
  if (preference.weekdays.length && preference.weekdays.indexOf(weekday) === -1) return false;
  if (!chatDaypartMatches_(start, preference.daypart)) return false;
  if (!preference.host) return true;
  const available = chatAvailableHosts_(start, new Date(start.getTime() + CHAT_MINUTES * 60000));
  return available.some(function (host) { return host.name === preference.host; });
}

function chatAssignmentRows_() {
  const sheet = SpreadsheetApp.openById(CHAT_LEAD_SPREADSHEET_ID).getSheetByName(CHAT_ASSIGNMENT_TAB);
  if (!sheet) throw new Error('Appointment assignment ledger is unavailable.');
  const expected = ['Event ID','Booked At (ET)','Call Start (ET)','Call End (ET)',
    'Assigned To','Assigned Email','Assignment Reason','Status','Last Synced (ET)',
    'Event Link','Notification Sent'];
  const headers = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
  if (headers.some(function (value, index) { return value !== expected[index]; })) {
    throw new Error('Appointment assignment ledger headers changed.');
  }
  return { sheet: sheet, rows: sheet.getLastRow() < 2 ? [] :
    sheet.getRange(2, 1, sheet.getLastRow() - 1, expected.length).getValues()
      .filter(function (row) { return row[0]; }) };
}

function chatPickHost_(available, rows, requestedName) {
  if (requestedName) {
    const requested = available.find(function (host) { return host.name === requestedName; });
    if (!requested) return null;
    return { host: requested, reason: 'Requested host' };
  }
  if (available.length === 1) return { host: available[0], reason: 'Only available host' };
  if (!available.length) return null;
  const counts = { Benjamin: 0, Ricardo: 0 };
  rows.forEach(function (row) {
    if (row[7] !== 'Assigned') return;
    if (row[4] === 'Both') {
      counts.Benjamin++;
      counts.Ricardo++;
    } else if (counts[row[4]] !== undefined) {
      counts[row[4]]++;
    }
  });
  if (counts.Benjamin !== counts.Ricardo) {
    const name = counts.Benjamin < counts.Ricardo ? 'Benjamin' : 'Ricardo';
    return { host: available.find(function (host) { return host.name === name; }), reason: 'Balancing all assigned calls' };
  }
  const recent = rows.slice().reverse().find(function (row) {
    return row[7] === 'Assigned' && (row[4] === 'Benjamin' || row[4] === 'Ricardo');
  });
  const next = recent && recent[4] === 'Benjamin' ? 'Ricardo' : 'Benjamin';
  return { host: available.find(function (host) { return host.name === next; }), reason: 'Balanced tie' };
}

function getChatBookingSlots(filters) {
  const includeAll = !!(filters && filters.all === true);
  const horizon = includeAll ? 30 : 21;
  const preference = chatBookingPreference_(filters);
  const assignmentRows = chatAssignmentRows_().rows;
  const dueHost = chatPickHost_(CHAT_HOSTS, assignmentRows, '').host.name;
  const windows = chatBookingWindows_();
  const slots = [];
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const searchEnd = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + horizon);
  const teamEvents = chatCalendar_(CHAT_CALENDAR_ID).getEvents(startDay, searchEnd);
  const teamBusy = chatBusyEvents_(CHAT_CALENDAR_ID, startDay, searchEnd, false, teamEvents).map(function (event) {
    return [event.getStartTime().getTime(), event.getEndTime().getTime()];
  });
  const assignedBusy = chatAssignedBusy_(startDay, searchEnd, null, teamEvents);
  const hostBusy = CHAT_HOSTS.map(function (host) {
    return { host: host, calendars: host.calendars.map(function (id) {
      return chatBusyRanges_(id, startDay, searchEnd, true);
    }).concat([assignedBusy[host.name]]) };
  });
  for (let dayIndex = 0; dayIndex < horizon && (includeAll || slots.length < 12); dayIndex++) {
    const day = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + dayIndex);
    windows[day.getDay()].forEach(function (period) {
      const firstHour = Number(period[0].slice(0, 2));
      const lastHour = Number(period[1].slice(0, 2));
      for (let hour = firstHour; hour + 1 <= lastHour && (includeAll || slots.length < 12); hour++) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
        const end = new Date(start.getTime() + CHAT_MINUTES * 60000);
        if (!chatSlotAllowed_(start, windows) || !chatRangeFree_(teamBusy, start, end)) continue;
        const availableHosts = hostBusy.filter(function (entry) {
          return entry.calendars.every(function (ranges) { return chatRangeFree_(ranges, start, end); });
        }).map(function (entry) { return entry.host; });
        if (availableHosts.length && (!preference.host || availableHosts.some(function (host) {
          return host.name === preference.host;
        })) && (!preference.date || Utilities.formatDate(start, CHAT_ZONE, 'yyyy-MM-dd') === preference.date) &&
            (!preference.weekdays.length || preference.weekdays.indexOf(day.getDay()) !== -1) &&
            chatDaypartMatches_(start, preference.daypart)) {
          slots.push({ start: start.toISOString(), minutes: CHAT_MINUTES, referralMinutes: 15, daypart: chatDaypart_(start),
            availableHosts: availableHosts.map(function (host) { return host.name; }),
            dueHostAvailable: availableHosts.some(function (host) { return host.name === dueHost; }) });
        }
      }
    });
  }
  slots.sort(function (a, b) {
    return Number(b.dueHostAvailable) - Number(a.dueHostAvailable) ||
      new Date(a.start).getTime() - new Date(b.start).getTime();
  });
  if (includeAll) {
    return { nextUp: dueHost, slots: slots.sort(function (a, b) {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    }) };
  }
  if (!preference.daypart && !preference.weekdays.length && !preference.date) {
    const afternoon = slots.find(function (slot) { return slot.daypart === 'afternoon'; });
    const evening = slots.find(function (slot) { return slot.daypart === 'evening'; });
    if (afternoon && evening) {
      return [afternoon, evening].concat(slots.filter(function (slot) {
        return slot !== afternoon && slot !== evening;
      })).slice(0, 6);
    }
  }
  return slots.slice(0, 6);
}

function checkChatBookingSlot(startIso) {
  if (typeof startIso !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(startIso)) {
    return { available: false };
  }
  return { available: chatSlotFree_(new Date(startIso), chatBookingWindows_()) };
}

function checkChatBookingSuggestion(value, filters) {
  const match = /^(\d{4})-(\d\d)-(\d\d)\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)\s*(?:ET|Eastern)?$/i.exec(String(value || '').trim());
  if (!match) return { available: false, formatError: true };
  const hour = Number(match[4]) % 12 + (match[6].toLowerCase() === 'pm' ? 12 : 0);
  const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, Number(match[5] || '0'));
  if (Utilities.formatDate(start, CHAT_ZONE, 'yyyy-MM-dd') !== match[1] + '-' + match[2] + '-' + match[3]) {
    return { available: false, formatError: true };
  }
  const preference = chatBookingPreference_(filters);
  return { available: chatSlotFree_(start, chatBookingWindows_()) && chatSlotMatches_(start, preference), start: start.toISOString() };
}

function chatSheetText_(value) {
  const text = String(value || '');
  // Sheets treats leading equals signs as formulas, even in appended rows.
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

// Extra client contacts are separate from primary lead and host assignment.
function chatExtraContacts_(contacts, primaryEmail) {
  if (contacts === undefined) return [];
  if (!Array.isArray(contacts) || contacts.length > 10) throw new Error('Add at most 10 additional attendees.');
  const seen = {}; seen[String(primaryEmail || '').toLowerCase()] = true;
  const hostEmails = [CHAT_CALENDAR_ID].concat(CHAT_HOSTS.reduce(function (all, host) { return all.concat([host.inviteEmail], host.calendars); }, []));
  return contacts.map(function (contact) {
    if (!contact || typeof contact !== 'object') throw new Error('Each attendee needs a name and email.');
    const name = String(contact.name || '').trim(), email = String(contact.email || '').trim().toLowerCase(), phone = String(contact.phone || '').trim();
    if (name.length < 2 || name.length > 100 || /[\r\n<>]/.test(name) || !/^[^\s@<>|]+@[^\s@<>|]+\.[^\s@<>|]+$/.test(email) || email.length > 200 || phone.length > 30 || /[\r\n|]/.test(phone) || phone && phone.replace(/\D/g, '').length < 10)
      throw new Error('Each attendee needs a valid name and email. Leave phone blank or enter a valid number.');
    if (hostEmails.some(function (value) { return value.toLowerCase() === email; })) throw new Error('Use the host selector or assignment buttons to add Benjamin or Ricardo.');
    if (seen[email]) throw new Error('Each attendee must have a different email.');
    seen[email] = true; return { name: name, email: email, phone: phone };
  });
}
function chatExtraDescription_(contacts) {
  return !contacts || !contacts.length ? '' : '\nAdditional attendees (admin portal):\n' + contacts.map(function (contact) {
    return contact.name + ' <' + contact.email + '>' + (contact.phone ? ' | Phone: ' + contact.phone : '');
  }).join('\n') + '\n';
}
function chatReadExtraContacts_(description) {
  const block = String(description || '').split('\nAdditional attendees (admin portal):\n')[1] || '';
  return block.split('\n').map(function (line) {
    const match = /^([^<>\r\n]+) <([^<>\s]+)>(?: \| Phone: ([^\r\n]+))?$/.exec(line);
    return match ? { name: match[1], email: match[2].toLowerCase(), phone: match[3] || '' } : null;
  }).filter(Boolean);
}

function chatBookingDescription_(name, email, phone, notes, host, callType, purpose, attendees, adminBooking) {
  const preference = callType === 'phone' ? '1. Phone call' : callType === 'office' ? '2. In-person meeting at the North Raleigh office' : 'Google video call';
  return (adminBooking ? 'Booked through the Living in Raleigh admin portal.\nInternal booking notification: suppressed (admin booking)\n' : 'Booked through the Living in Raleigh website chat.\n') +
    'Pre-call email: standard pipeline\n' +
    'Assigned host: ' + host + '\n' +
    'Booked by:\n' + name + '\n' + email + '\n' + phone + '\n' +
    'If you would prefer a phone call or an in-person meeting at our North Raleigh office, please indicate so here!\n' +
    preference + '\n' +
    'Please include any information you would like me to know before our meeting!\n' +
    (notes || 'Optional') + '\n' +
    'Please indicate whether you are looking to buy, sell, or invest in Raleigh\n' +
    (purpose || 'Not specified') + '\n' +
    "I'm looking forward to meeting you. Please feel free to invite your spouse, family, or anyone else who should be on this call.\n" + chatExtraDescription_(attendees);
}

function chatVideoEvent_(requestId, start, end, name, email, phone, notes, host, purpose, attendees, adminBooking) {
  const payload = {
    summary: 'Exploration Call: Living in Raleigh Team (' + name + ')',
    start: { dateTime: start.toISOString(), timeZone: CHAT_ZONE },
    end: { dateTime: end.toISOString(), timeZone: CHAT_ZONE },
    description: chatBookingDescription_(name, email, phone, notes, host.name, 'video', purpose, attendees, adminBooking),
    attendees: [{ email: email, displayName: name }].concat((attendees || []).map(function (contact) { return { email: contact.email, displayName: contact.name }; })).concat(host.inviteEmail.split(',').map(function (address) { return { email: address }; })),
    conferenceData: { createRequest: { requestId: requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] }
  };
  // Use the already-enabled Calendar service, not UrlFetchApp. Calendar access
  // must not depend on the separate outbound-web-request permission.
  const event = Calendar.Events.insert(payload, CHAT_CALENDAR_ID, { conferenceDataVersion: 1, sendUpdates: 'all' });
  let videoUrl = event.hangoutLink || '';
  if (!videoUrl && event.id) {
    for (let attempt = 0; attempt < 5 && !videoUrl; attempt++) {
      Utilities.sleep(400);
      let updated;
      try { updated = Calendar.Events.get(CHAT_CALENDAR_ID, event.id); }
      catch (error) {
        // The event exists. Preserve the booking receipt instead of throwing a
        // post-insert error that could lead the visitor to book a duplicate.
        console.warn('Meet link readback pending: ' + error); break;
      }
      videoUrl = updated.hangoutLink || '';
      if (updated.conferenceData && updated.conferenceData.createRequest && updated.conferenceData.createRequest.status &&
          updated.conferenceData.createRequest.status.statusCode === 'failure') break;
    }
  }
  if (!videoUrl) {
    MailApp.sendEmail('livinginraleighteam@gmail.com', 'Chat video booking needs a meeting link',
      'A video call was booked, but Google Meet has not supplied a link yet. Check calendar event ' + (event.iCalUID || event.id));
  }
  return { id: event.iCalUID || event.id, videoUrl: videoUrl, eventUrl: event.htmlLink || '' };
}

// Referral calls use the same real opening windows and host assignment as exploration calls.
// Availability searches remain conservative (a full 60-minute opening); only the event is shorter.
function chatAppointmentMinutes_(details) {
  const kind = String(details.appointmentType || 'exploration');
  if (kind === 'seller_referral') {
    if (String(details.callType || 'phone').toLowerCase() !== 'phone' ||
        String(details.purpose || '') !== 'Sell' || Number(details.durationMinutes) !== 15)
      throw new Error('A seller referral must be a 15-minute phone call about selling.');
    return 15;
  }
  if (kind !== 'exploration' || details.durationMinutes !== undefined && Number(details.durationMinutes) !== CHAT_MINUTES)
    throw new Error('Unsupported appointment type or length.');
  return CHAT_MINUTES;
}

function bookChatAppointment(details) {
  return bookAppointment_(details, false);
}

function bookAppointment_(details, authorizedAdmin, adminCustom) {
  if (adminCustom && !authorizedAdmin) throw new Error('Custom times require team sign-in.');
  if (!authorizedAdmin && PropertiesService.getScriptProperties().getProperty('CHAT_BOOKING_TEST_READ_ONLY') === 'true')
    throw new Error('Chat booking is paused for testing. No appointment was created. Please call the team at 919-737-7896 if you need to book now.');
  if (!details || typeof details !== 'object') throw new Error('Missing booking details.');
  const requestId = String(details.requestId || '');
  const start = adminCustom ? adminCustomRange_(details).start : new Date(String(details.start || ''));
  const name = String(details.name || '').trim().slice(0, 100);
  const email = String(details.email || '').trim().toLowerCase().slice(0, 200);
  const phone = String(details.phone || '').trim().slice(0, 30);
  const notes = String(details.notes || '').trim().slice(0, 1000);
  const callType = String(details.callType || 'phone').toLowerCase();
  const purpose = String(details.purpose || '').trim().slice(0, 60);
  const appointmentMinutes = chatAppointmentMinutes_(details);
  const bothRequested = String(details.preferredHost || '') === 'Both';
  const preferredHost = bothRequested ? 'Both' : chatBookingPreference_({ host: details.preferredHost }).host;
  if (!/^[a-z0-9-]{16,80}$/i.test(requestId) || name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || ((!authorizedAdmin || callType === 'phone' || phone) && phone.replace(/\D/g, '').length < 10) ||
      !/^(phone|video|office)$/.test(callType)) {
    throw new Error('Please check your booking details.');
  }
  const attendees = authorizedAdmin ? chatExtraContacts_(details.attendees, email) : [];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = CacheService.getScriptCache();
    const receiptKey = 'chat-booking-receipt-' + requestId;
    const previous = cache.get(receiptKey);
    if (previous) return JSON.parse(previous);
    const customCheck = adminCustom ? adminCheckCustomTime_(details) : null;
    if (adminCustom ? !customCheck.available : !chatSlotFree_(start, chatBookingWindows_()))
      throw new Error(adminCustom ? 'This custom time overlaps an existing calendar event. Check it again and choose another time.' : 'That time was taken. Please choose another.');
    const end = new Date(start.getTime() + appointmentMinutes * 60000);
    const assignment = chatAssignmentRows_();
    const availableHosts = adminCustom ? CHAT_HOSTS.filter(function (host) { return preferredHost === 'Both' || host.name === preferredHost; }) : chatAvailableHosts_(start, end);
    const choice = bothRequested ? (availableHosts.length === CHAT_HOSTS.length ? {
      host: { name: 'Both', inviteEmail: CHAT_HOSTS.map(function (host) { return host.inviteEmail; }).join(',') },
      reason: 'Both hosts requested'
    } : null) : chatPickHost_(availableHosts, assignment.rows, preferredHost);
    if (!choice) throw new Error(preferredHost ?
      preferredHost + ' is no longer available at that time. Please choose another.' :
      'That time was taken. Please choose another.');
    // A public booking endpoint needs bounded volume even though it cannot
    // identify a visitor by IP. These limits count completed events, not page views.
    const properties = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), CHAT_ZONE, 'yyyyMMdd');
    const countKey = 'CHAT_BOOKING_COUNT_' + day;
    const emailHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)
      .map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join('').slice(0, 20);
    const emailKey = 'CHAT_BOOKING_EMAIL_' + day + '_' + emailHash;
    const total = Number(properties.getProperty(countKey) || '0');
    const emailTotal = Number(properties.getProperty(emailKey) || '0');
    if (total >= 20 || emailTotal >= 2) throw new Error('Chat booking is temporarily unavailable. Please call the team at 919-737-7896.');
    const calendar = chatCalendar_(CHAT_CALENDAR_ID);
    const video = callType === 'video' ? chatVideoEvent_(requestId, start, end, name, email, phone, notes, choice.host, purpose, attendees, authorizedAdmin) : null;
    const event = video ? null : calendar.createEvent('Exploration Call: Living in Raleigh Team (' + name + ')', start, end, {
      description: chatBookingDescription_(name, email, phone, notes, choice.host.name, callType, purpose, attendees, authorizedAdmin),
      location: callType === 'office' ? 'North Raleigh office' : 'Phone call',
      guests: [email, choice.host.inviteEmail].concat(attendees.map(function (contact) { return contact.email; })).join(','), sendInvites: true
    });
    if (event) {
      try { event.addEmailReminder(1440); event.addPopupReminder(30); }
      catch (reminderError) { console.warn('Calendar reminders could not be set: ' + reminderError); }
    }
    const eventId = video ? video.id : event.getId();
    try {
      const tagged = event || calendar.getEventById(eventId);
      if (tagged) tagged.setTag('RR_ASSIGNED_HOST', choice.host.name);
      if (tagged && authorizedAdmin) tagged.setTag('RR_SUPPRESS_BOOKED_EMAIL', 'admin');
      if (tagged) chatSetTeamFree_(tagged);
    } catch (tagError) { console.warn('Assignment tag could not be saved: ' + tagError); }
    const format = function (value) { return Utilities.formatDate(value, CHAT_ZONE, 'yyyy-MM-dd HH:mm'); };
    let hostPending = false;
    try {
      assignment.sheet.appendRow([eventId, format(new Date()), format(start), format(end), choice.host.name,
        choice.host.inviteEmail, choice.reason, 'Assigned', format(new Date()), video ? video.eventUrl : '', authorizedAdmin ? 'Suppressed (admin)' : '']);
    } catch (assignmentError) {
      hostPending = true;
      try {
        MailApp.sendEmail('livinginraleighteam@gmail.com', 'Chat booking needs round-robin ledger repair',
          'A chat booking was created and ' + choice.host.name + ' was invited, but its assignment ledger row failed. Event ID: ' +
          eventId + '\nError: ' + String(assignmentError));
      } catch (mailError) { console.error('Assignment repair email failed: ' + mailError); }
    }
    const result = { booked: true, start: start.toISOString(), eventId: eventId, hostPending: hostPending,
      durationMinutes: appointmentMinutes, assignedHost: choice.host.name, callType: callType, videoUrl: video ? video.videoUrl : '',
      preCallEmailQueued: true };
    cache.put(receiptKey, JSON.stringify(result), 21600);
    properties.setProperty(countKey, String(total + 1));
    properties.setProperty(emailKey, String(emailTotal + 1));
    try {
      const workbook = SpreadsheetApp.openById(CHAT_LEAD_SPREADSHEET_ID);
      const sheet = workbook.getSheetByName(CHAT_LEAD_TAB) || workbook.insertSheet(CHAT_LEAD_TAB);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Booked At', 'Calendar Event ID', 'Starts At', 'Name', 'Email', 'Phone', 'Notes', 'Source', 'Status']);
      }
      sheet.appendRow([new Date(), eventId, start, chatSheetText_(name), chatSheetText_(email), chatSheetText_(phone),
        chatSheetText_(notes), (authorizedAdmin ? 'Admin portal · ' : 'Website chat · ') + callType, 'Booked']);
    } catch (sheetError) {
      try {
        MailApp.sendEmail('livinginraleighteam@gmail.com', 'Chat booking needs lead-sheet repair',
          'A chat booking was created on the team calendar, but it could not be written to Chat Appointments. Event ID: ' +
          eventId + '\nError: ' + String(sheetError));
      } catch (_) { /* The event and guest invitation still exist. */ }
    }
    cache.put(receiptKey, JSON.stringify(result), 21600);
    return result;
  } finally { lock.releaseLock(); }
}

// Owner-run, read-only deployment check. Creates no event and sends no email.
function bookingCalendarReadiness() {
  const calendar = Calendar.Calendars.get(CHAT_CALENDAR_ID);
  const recent = Calendar.Events.list(CHAT_CALENDAR_ID, { timeMin: new Date(Date.now() - 3600000).toISOString(), timeMax: new Date(Date.now() + 3600000).toISOString(), maxResults: 10 });
  const result = { calendarReadable: calendar.id === CHAT_CALENDAR_ID, calendarServiceReady: Array.isArray(recent.items || []),
    videoBookingUsesCalendarService: true, requiresUrlFetchForBooking: false, createsEvents: false };
  console.log(JSON.stringify(result)); return result;
}
