(function () {
  'use strict';
  var endpoint = 'https://script.google.com/macros/s/AKfycbysLAettKRWslMW8YgG3BxftA2eBL_gsZFdK70bN7B3xu-aG_stqdNqg3jYBB5aqoMa2g/exec';
  var bridge, currentHost = '', selectedDate = '', available = [], highlightedDates = [], requestSequence = 0;
  var status = document.getElementById('status');
  var bookingCard = document.getElementById('booking-card');
  var unlockCard = document.getElementById('unlock-card');
  var slots = document.getElementById('slots');
  var dates = document.getElementById('calendar-dates');
  var bookButton = document.getElementById('book-button');
  function randomId() { return Array.from(crypto.getRandomValues(new Uint8Array(24)), function (n) { return n.toString(16).padStart(2, '0'); }).join(''); }
  function notice(value, error) { status.textContent = value; status.className = error ? 'error' : ''; }
  function connect() {
    if (bridge) return bridge.ready;
    var channel = randomId(), pending = {}, frame = document.createElement('iframe');
    frame.credentialless = true; frame.hidden = true; frame.title = 'Booking service'; frame.src = endpoint + '?channel=' + channel;
    var readyResolve, readyReject;
    var ready = new Promise(function (resolve, reject) { readyResolve = resolve; readyReject = reject; });
    bridge = { ready: ready, channel: channel, pending: pending, frame: frame, source: null, origin: null };
    window.addEventListener('message', function (event) {
      if (!/^(?:https:\/\/script\.google\.com|https:\/\/[^/]+\.googleusercontent\.com)$/.test(event.origin) || !event.data ||
          event.data.protocol !== 'raleigh-chat-booking-v1' || event.data.channel !== channel) return;
      if (event.data.ready) { bridge.source = event.source; bridge.origin = event.origin; readyResolve(); return; }
      var request = pending[event.data.requestId];
      if (!request || event.source !== bridge.source) return;
      clearTimeout(request.timer); delete pending[event.data.requestId];
      event.data.error ? request.reject(new Error(event.data.error)) : request.resolve(event.data.result);
    });
    document.body.appendChild(frame);
    setTimeout(function () { if (!bridge.source) readyReject(new Error('Booking service did not respond.')); }, 15000);
    return ready;
  }
  function call(method, args) {
    return connect().then(function () { return new Promise(function (resolve, reject) {
      var id = randomId();
      var timer = setTimeout(function () { delete bridge.pending[id]; reject(new Error('Booking request timed out.')); }, 30000);
      bridge.pending[id] = { resolve: resolve, reject: reject, timer: timer };
      bridge.source.postMessage({ protocol: 'raleigh-chat-booking-v1', channel: bridge.channel, requestId: id, method: method, args: args || [] }, bridge.origin);
    }); });
  }
  function selectedStart() { var chosen = document.querySelector('input[name="slot"]:checked'); return chosen ? chosen.value : ''; }
  function dateKey(date) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    var values = {}; parts.forEach(function (part) { values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
  }
  function calendarDays() {
    var today = dateKey(new Date()).split('-').map(Number);
    return Array.from({ length: 21 }, function (_, index) { return new Date(Date.UTC(today[0], today[1] - 1, today[2] + index, 16)); });
  }
  function renderCalendar() {
    dates.replaceChildren();
    calendarDays().forEach(function (day) {
      var key = dateKey(day), button = document.createElement('button'), weekday = document.createElement('small');
      button.type = 'button'; button.dataset.date = key; button.setAttribute('aria-pressed', key === selectedDate ? 'true' : 'false');
      button.setAttribute('aria-label', new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(day));
      if (highlightedDates.indexOf(key) !== -1) button.classList.add('has-opening');
      weekday.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(day);
      button.append(weekday, document.createTextNode(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric' }).format(day)));
      button.addEventListener('click', function () { selectDate(key); });
      dates.appendChild(button);
    });
  }
  function renderSlots() {
    slots.replaceChildren(); bookButton.disabled = true;
    if (!available.length) { slots.textContent = 'No openings on this date. Choose another day.'; return; }
    available.forEach(function (slot) {
      var label = document.createElement('label'), radio = document.createElement('input'), text = document.createElement('span');
      radio.type = 'radio'; radio.name = 'slot'; radio.value = slot.start; radio.required = true;
      radio.addEventListener('change', function () { bookButton.disabled = false; });
      text.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(slot.start));
      label.append(radio, text); slots.appendChild(label);
    });
  }
  function selectDate(key) {
    if (!currentHost) return;
    selectedDate = key; available = []; bookButton.disabled = true;
    document.getElementById('chosen-date').textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(key + 'T16:00:00Z'));
    renderCalendar(); slots.textContent = 'Checking openings…'; notice('');
    var sequence = ++requestSequence, host = currentHost;
    call('slots', [{ host: host, date: key }]).then(function (result) {
      if (sequence !== requestSequence || host !== currentHost || key !== selectedDate) return;
      available = Array.isArray(result) ? result.filter(function (slot) { return dateKey(new Date(slot.start)) === key && slot.availableHosts && slot.availableHosts.indexOf(host) !== -1; }).sort(function (a, b) {
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      }) : [];
      if (available.length && highlightedDates.indexOf(key) === -1) { highlightedDates.push(key); renderCalendar(); }
      renderSlots();
    }).catch(function (error) { if (sequence === requestSequence) { slots.textContent = ''; notice(error.message, true); } });
  }
  function refresh() {
    var host = document.querySelector('input[name="host"]:checked');
    if (!host) return;
    currentHost = host.value; selectedDate = ''; highlightedDates = []; requestSequence++;
    document.getElementById('host-label').textContent = currentHost;
    document.getElementById('chosen-date').textContent = 'Finding the next opening';
    renderCalendar(); available = []; slots.textContent = 'Checking ' + currentHost + '\'s calendar…'; bookButton.disabled = true;
    notice('');
    var sequence = requestSequence, selectedHost = currentHost;
    call('slots', [{ host: currentHost }]).then(function (result) {
      if (sequence !== requestSequence || selectedHost !== currentHost) return;
      var next = Array.isArray(result) ? result.filter(function (slot) { return slot.availableHosts && slot.availableHosts.indexOf(currentHost) !== -1; }).sort(function (a, b) {
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      }) : [];
      highlightedDates = next.map(function (slot) { return dateKey(new Date(slot.start)); });
      if (next.length) selectDate(dateKey(new Date(next[0].start)));
      else { renderCalendar(); slots.textContent = 'No openings found in the next three weeks.'; document.getElementById('chosen-date').textContent = 'No openings found'; }
    }).catch(function (error) { if (sequence === requestSequence) { available = []; slots.textContent = ''; notice(error.message, true); } });
  }
  document.getElementById('unlock-form').addEventListener('submit', function (event) {
    event.preventDefault(); notice('Checking access…');
    var field = document.getElementById('passcode');
    if (field.value !== '123456') { field.value = ''; notice('Incorrect passcode.', true); return; }
    field.value = ''; unlockCard.hidden = true; bookingCard.hidden = false;
    notice('Choose Benjamin or Ricardo to see their available times.');
  });
  document.querySelectorAll('input[name="host"]').forEach(function (input) { input.addEventListener('change', refresh); });
  document.getElementById('refresh-slots').addEventListener('click', refresh);
  document.getElementById('booking-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var start = selectedStart(), host = document.querySelector('input[name="host"]:checked');
    if (!start || !host || host.value !== currentHost || !available.some(function (slot) { return slot.start === start && slot.availableHosts.indexOf(host.value) !== -1; })) {
      notice('Choose an available time for the selected person.', true); return;
    }
    var form = new FormData(event.currentTarget);
    var details = { requestId: randomId(), start: start, preferredHost: host.value, name: String(form.get('name') || ''),
      email: String(form.get('email') || ''), phone: String(form.get('phone') || ''), callType: String(form.get('callType') || ''), notes: String(form.get('notes') || '') };
    bookButton.disabled = true; notice('Confirming the calendar and booking…');
    call('book', [details]).then(function (result) {
      if (!result || !result.booked || result.assignedHost !== host.value) throw new Error('Booking needs manual assignment review.');
      notice('Booked with ' + result.assignedHost + '. The calendar invitation was sent.' + (result.preCallEmailSent === false ? ' The pre-call email needs follow-up.' : ''));
      event.target.reset(); available = []; selectedDate = ''; highlightedDates = []; slots.textContent = 'Choose a host to see their times.'; currentHost = '';
      document.getElementById('host-label').textContent = 'your selection'; document.getElementById('chosen-date').textContent = 'Choose a host first'; dates.replaceChildren();
    }).catch(function (error) { notice(error.message, true); refresh(); });
  });
}());
