(function () {
  'use strict';
  var endpoint = 'https://script.google.com/macros/s/AKfycbysLAettKRWslMW8YgG3BxftA2eBL_gsZFdK70bN7B3xu-aG_stqdNqg3jYBB5aqoMa2g/exec';
  var bridge, currentHost = '', allSlots = [], nextUp = '', pageIndex = 0, loading = false;
  var status = document.getElementById('status');
  var bookingCard = document.getElementById('booking-card');
  var unlockCard = document.getElementById('unlock-card');
  var days = document.getElementById('days');
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
    return Array.from({ length: 30 }, function (_, index) { return new Date(Date.UTC(today[0], today[1] - 1, today[2] + index, 16)); });
  }
  function hostMatches(slot) {
    return slot.availableHosts && (currentHost === 'Both' ?
      slot.availableHosts.indexOf('Benjamin') !== -1 && slot.availableHosts.indexOf('Ricardo') !== -1 :
      slot.availableHosts.indexOf(currentHost) !== -1);
  }
  function render() {
    var calendar = calendarDays(), first = pageIndex * 5, visible = calendar.slice(first, first + 5);
    var shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
    document.getElementById('date-range').textContent = shortDate.format(visible[0]) + ' – ' + shortDate.format(visible[4]);
    document.getElementById('previous-days').disabled = pageIndex === 0;
    document.getElementById('next-days').disabled = pageIndex >= 5;
    days.replaceChildren(); bookButton.disabled = true;
    if (!currentHost || loading) { days.textContent = loading ? 'Loading available times…' : 'Choose who will take the call to see openings.'; return; }
    visible.forEach(function (day) {
      var key = dateKey(day), column = document.createElement('div'), heading = document.createElement('h3');
      var weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(day);
      var date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(day);
      column.className = 'day-column'; heading.textContent = weekday;
      var small = document.createElement('small'); small.textContent = date; heading.appendChild(small); column.appendChild(heading);
      var openings = allSlots.filter(function (slot) { return dateKey(new Date(slot.start)) === key && hostMatches(slot); });
      if (!openings.length) { var empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No openings'; column.appendChild(empty); }
      openings.forEach(function (slot) {
        var label = document.createElement('label'), radio = document.createElement('input'), text = document.createElement('span');
        label.className = 'slot-choice'; radio.type = 'radio'; radio.name = 'slot'; radio.value = slot.start; radio.required = true;
        radio.addEventListener('change', function () { bookButton.disabled = false; });
        text.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(slot.start));
        label.append(radio, text); column.appendChild(label);
      });
      days.appendChild(column);
    });
  }
  function loadAvailability(preserveNotice) {
    if (loading) return;
    loading = true; days.textContent = 'Checking both calendars once…'; bookButton.disabled = true; if (preserveNotice !== true) notice('');
    call('slots', [{ all: true }]).then(function (result) {
      if (!result || !Array.isArray(result.slots) || !/^(Benjamin|Ricardo)$/.test(result.nextUp || '')) {
        throw new Error('The booking service needs its availability update before this page can show times.');
      }
      allSlots = result.slots; nextUp = result.nextUp;
      document.getElementById('next-up').textContent = 'Based on round robin, ' + nextUp + ' is next up. Choose who will take this call.';
      loading = false; render();
    }).catch(function (error) { loading = false; days.textContent = ''; notice(error.message, true); });
  }
  function changeHost() { currentHost = document.querySelector('input[name="host"]:checked').value; pageIndex = 0; render(); }
  function unlockBooking() {
    unlockCard.hidden = true; bookingCard.hidden = false;
    notice('Choose who will take the call.'); loadAvailability();
  }
  if (new URLSearchParams(location.search).get('portal') === '1' && window.parent !== window) {
    var portalCredential = sessionStorage.getItem('lirAdminCredential');
    if (portalCredential) {
      notice('Checking team sign-in…');
      call('admin', [portalCredential, 'session', {}]).then(function () { unlockBooking(); })
        .catch(function () { notice('Please sign in to the team portal again.', true); });
    }
  }
  document.querySelectorAll('input[name="host"]').forEach(function (input) { input.addEventListener('change', changeHost); });
  document.getElementById('refresh-slots').addEventListener('click', loadAvailability);
  document.getElementById('previous-days').addEventListener('click', function () { pageIndex--; render(); });
  document.getElementById('next-days').addEventListener('click', function () { pageIndex++; render(); });
  document.getElementById('booking-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var start = selectedStart(), host = document.querySelector('input[name="host"]:checked');
    if (!start || !host || host.value !== currentHost || !allSlots.some(function (slot) { return slot.start === start && hostMatches(slot); })) {
      notice('Choose an available time for the selected person.', true); return;
    }
    var form = new FormData(event.currentTarget);
    var details = { requestId: randomId(), start: start, preferredHost: host.value, name: String(form.get('name') || ''),
      email: String(form.get('email') || ''), phone: String(form.get('phone') || ''), callType: String(form.get('callType') || ''),
      purpose: String(form.get('purpose') || ''), notes: String(form.get('notes') || '') };
    bookButton.disabled = true; notice('Confirming the calendar and booking…');
    call('book', [details]).then(function (result) {
      if (!result || !result.booked || result.assignedHost !== host.value) throw new Error('Booking needs manual assignment review.');
      notice('Booked with ' + (result.assignedHost === 'Both' ? 'Benjamin and Ricardo' : result.assignedHost) + '. The calendar invitation was sent. The standard pre-call email is queued.');
      event.target.reset(); currentHost = ''; allSlots = []; pageIndex = 0; render(); loadAvailability(true);
    }).catch(function (error) { notice(error.message, true); loadAvailability(true); });
  });
}());
