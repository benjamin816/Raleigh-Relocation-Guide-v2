(function () {
  'use strict';
  var endpoint = 'https://script.google.com/macros/s/AKfycbysLAettKRWslMW8YgG3BxftA2eBL_gsZFdK70bN7B3xu-aG_stqdNqg3jYBB5aqoMa2g/exec';
  var relayEndpoint = window.RALEIGH_BOOKING_RELAY_URL || '';
  var protocol = 'raleigh-chat-booking-v1';
  var credential = sessionStorage.getItem('lirAdminCredential') || '';
  var bridge, pendingAction;
  var $ = function (id) { return document.getElementById(id); };
  function randomId() { return Array.from(crypto.getRandomValues(new Uint8Array(24)), function (n) { return n.toString(16).padStart(2, '0'); }).join(''); }
  function status(message) { $('portal-status').textContent = message || ''; }
  function connect() {
    if (bridge) return bridge.ready;
    var channel = randomId(), pending = {}, frame = document.createElement('iframe');
    frame.credentialless = true; frame.hidden = true; frame.title = 'Private portal service'; frame.src = endpoint + '?channel=' + channel;
    var resolveReady, rejectReady;
    var ready = new Promise(function (resolve, reject) { resolveReady = resolve; rejectReady = reject; });
    bridge = { ready: ready, channel: channel, pending: pending, source: null, origin: null };
    window.addEventListener('message', function (event) {
      if (!/^(?:https:\/\/script\.google\.com|https:\/\/[^/]+\.googleusercontent\.com)$/.test(event.origin) || !event.data ||
          event.data.protocol !== protocol || event.data.channel !== channel) return;
      if (event.data.ready) { bridge.source = event.source; bridge.origin = event.origin; resolveReady(); return; }
      var request = pending[event.data.requestId];
      if (!request || bridge.source !== event.source) return;
      clearTimeout(request.timer); delete pending[event.data.requestId];
      event.data.error ? request.reject(new Error(event.data.error)) : request.resolve(event.data.result);
    });
    document.body.appendChild(frame);
    setTimeout(function () { if (!bridge.source) rejectReady(new Error('The portal service did not respond.')); }, 15000);
    return ready;
  }
  function call(method, args) {
    if (relayEndpoint) return fetch(relayEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: method, args: args || [] }), cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('The portal service is unavailable.');
      return response.json();
    }).then(function (message) { if (!message.ok) throw new Error(message.error || 'The portal request failed.'); return message.result; });
    return connect().then(function () { return new Promise(function (resolve, reject) {
      var id = randomId();
      var timer = setTimeout(function () { delete bridge.pending[id]; reject(new Error('The portal request timed out.')); }, 45000);
      bridge.pending[id] = { resolve: resolve, reject: reject, timer: timer };
      bridge.source.postMessage({ protocol: protocol, channel: bridge.channel, requestId: id,
        method: method, args: args || [] }, bridge.origin);
    }); });
  }
  function admin(action, data) { return call('admin', [credential, action, data || {}]); }
  function unlock(result) {
    $('signin').hidden = true; $('workspace').hidden = false;
    $('account').textContent = result.viewer.email;
    var scheduleFrame = document.querySelector('#schedule iframe');
    if (scheduleFrame) scheduleFrame.src = '/admin/consult/?portal=1';
    if (location.hash === '#appointments') selectTab('appointments');
    else if (location.hash === '#analytics') selectTab('analytics');
  }
  function signOut() { credential = ''; sessionStorage.removeItem('lirAdminCredential'); $('signin').hidden = false; $('workspace').hidden = true; }
  function signIn(response) {
    $('signin-status').textContent = 'Checking your sign-in…';
    credential = response.credential;
    admin('session').then(function (result) {
      sessionStorage.setItem('lirAdminCredential', credential); $('signin-status').textContent = ''; unlock(result);
    }).catch(function (error) { signOut(); $('signin-status').textContent = error.message; });
  }
  function loadLogin() {
    call('adminConfig').then(function (config) {
      if (!config || !config.clientId) throw new Error('Google sign-in has not been configured yet.');
      var attempts = 0;
      function initialize() {
        if (!window.google || !google.accounts || !google.accounts.id) {
          if (++attempts < 30) return setTimeout(initialize, 200);
          throw new Error('Google sign-in did not load.');
        }
        google.accounts.id.initialize({ client_id: config.clientId, callback: signIn, auto_select: true });
        google.accounts.id.renderButton($('google-button'), { theme: 'outline', size: 'large', text: 'signin_with' });
        if (credential) admin('session').then(unlock).catch(signOut);
      }
      initialize();
    }).catch(function (error) { $('signin-status').textContent = error.message; });
  }
  function selectTab(name) {
    document.querySelectorAll('.tabs button').forEach(function (button) { button.setAttribute('aria-selected', button.dataset.tab === name); });
    document.querySelectorAll('.panel').forEach(function (panel) { panel.classList.toggle('active', panel.id === name); });
    history.replaceState(null, '', '#' + name);
    if (name === 'appointments') loadAppointments();
    if (name === 'analytics') loadAnalytics();
  }
  function metric(label, value, note) {
    var card = document.createElement('div'); card.className = 'metric';
    var title = document.createElement('span'), number = document.createElement('strong'), small = document.createElement('small');
    title.textContent = label; number.textContent = value; small.textContent = note || '';
    card.append(title, number, small); return card;
  }
  function detail(label, value) {
    var node = document.createElement('div');
    var strong = document.createElement('strong'); strong.textContent = label + ': ';
    node.append(strong, document.createTextNode(value || 'Not provided')); return node;
  }
  function formatTime(iso) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
  }
  function actionButton(label, fn, danger) {
    var button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    if (danger) button.className = 'danger'; button.addEventListener('click', fn); return button;
  }
  function confirm(title, copy, cancel) {
    $('confirm-title').textContent = title; $('confirm-copy').textContent = copy;
    $('cancel-confirm').hidden = !cancel; $('confirm-text').value = '';
    $('confirm-action').disabled = !!cancel; pendingAction = null;
    $('confirm-dialog').showModal();
    return new Promise(function (resolve) { pendingAction = { resolve: resolve, cancel: cancel }; });
  }
  $('confirm-dialog').addEventListener('close', function () {
    if (pendingAction) { pendingAction.resolve($('confirm-dialog').returnValue === 'confirm'); pendingAction = null; }
  });
  $('confirm-text').addEventListener('input', function () { $('confirm-action').disabled = $('confirm-text').value !== 'CANCEL'; });
  function changeHost(appt, host) {
    var title = host === 'Both' ? 'Add both hosts?' : 'Transfer to ' + host + '?';
    var copy = 'This changes the calendar invitation and round-robin record for ' + appt.client + ' on ' + formatTime(appt.start) +
      '. The client pre-call email will not be sent again.';
    confirm(title, copy, false).then(function (ok) {
      if (!ok) return;
      return confirm('Final confirmation', 'Confirm ' + (host === 'Both' ? 'both hosts' : host) + ' for this appointment.', false)
        .then(function (sure) { if (!sure) return; status('Updating appointment…');
          return admin('assignment', { id: appt.id, expectedHost: appt.host, host: host, confirm: true })
            .then(function () { status('Assignment updated.'); loadAppointments(); }); });
    }).catch(function (error) { status(error.message); });
  }
  function cancelAppointment(appt) {
    confirm('Cancel appointment?', 'This will cancel ' + appt.client + '’s appointment on ' + formatTime(appt.start) + '.', false)
      .then(function (ok) { if (!ok) return; return confirm('Final cancellation', 'Type CANCEL to confirm. This removes the calendar event.', true)
        .then(function (sure) { if (!sure) return; status('Cancelling appointment…');
          return admin('cancel', { id: appt.id, confirm: true, confirmText: $('confirm-text').value })
            .then(function () { status('Appointment cancelled.'); loadAppointments(); }); }); })
      .catch(function (error) { status(error.message); });
  }
  function loadAppointments() {
    var list = $('appointment-list'); list.textContent = 'Loading appointments…';
    admin('appointments').then(function (result) {
      $('rotation').replaceChildren(metric('Benjamin this month', result.counts.Benjamin, result.month),
        metric('Ricardo this month', result.counts.Ricardo, result.month), metric('Next in rotation', result.nextUp, 'When both are available'));
      list.replaceChildren();
      if (!result.appointments.length) { list.textContent = 'No upcoming exploration calls found.'; return; }
      result.appointments.forEach(function (appt) {
        var card = document.createElement('article'); card.className = 'appointment';
        var name = document.createElement('h3'); name.textContent = appt.client || appt.title;
        var time = document.createElement('p'); time.className = 'meta'; time.textContent = formatTime(appt.start);
        var details = document.createElement('div'); details.className = 'detail';
        details.append(detail('Assigned to', appt.host), detail('Meeting', appt.type),
          detail('Pre-call email', appt.emailStatus), detail('Looking to', appt.purpose),
          detail('Email', appt.email), detail('Phone', appt.phone),
          detail('Notes', appt.notes), detail('Attendees', appt.guests.join(', ')));
        var actions = document.createElement('div'); actions.className = 'actions';
        ['Benjamin', 'Ricardo', 'Both'].filter(function (host) { return host !== appt.host; }).forEach(function (host) {
          actions.appendChild(actionButton(host === 'Both' ? 'Add both hosts' : 'Transfer to ' + host,
            function () { changeHost(appt, host); }));
        });
        actions.appendChild(actionButton('Cancel appointment', function () { cancelAppointment(appt); }, true));
        card.append(name, time, details, actions); list.appendChild(card);
      });
    }).catch(function (error) { list.textContent = error.message; });
  }
  function loadAnalytics() {
    $('tracking-status').textContent = 'Reading raw website events…';
    admin('analytics', { range: $('analytics-range').value }).then(function (result) {
      $('tracking-status').className = result.stale ? 'warning' : '';
      $('tracking-status').textContent = result.stale ? 'Tracking may be stale. Last real page view: ' + (result.latestReal || 'none found') :
        'Raw event log · ' + result.start + ' to ' + result.end + ' · last real page view ' + result.latestReal;
      $('analytics-metrics').replaceChildren(metric('Tracked visits', result.visits, 'Unique sessions'),
        metric('Tracked enquiries', result.enquiries, 'Successful form sessions'),
        metric('Booking-page visitors', result.bookingVisitors, 'Unique /consult/ sessions'));
      var chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chart.setAttribute('class', 'line-chart'); chart.setAttribute('viewBox', '0 0 800 180');
      chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Tracked visits by day');
      var max = Math.max(1, ...result.series.map(function (point) { return point.visits; }));
      var points = result.series.map(function (point, index) {
        var x = result.series.length === 1 ? 400 : index / (result.series.length - 1) * 780 + 10;
        return x.toFixed(1) + ',' + (165 - point.visits / max * 145).toFixed(1);
      }).join(' ');
      if (points) {
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('points', points); line.setAttribute('fill', 'none');
        line.setAttribute('stroke', '#2b715b'); line.setAttribute('stroke-width', '4');
        line.setAttribute('stroke-linejoin', 'round'); chart.appendChild(line);
      }
      $('visits-chart').replaceChildren(chart);
      var caption = document.createElement('p'); caption.className = 'chart-caption';
      caption.textContent = result.series.length ? result.series[0].date + ' to ' + result.series[result.series.length - 1].date : 'No tracked visits in this range.';
      $('visits-chart').appendChild(caption);
      $('top-pages').replaceChildren();
      var top = Math.max(1, ...result.topPages.map(function (page) { return page.views; }));
      result.topPages.forEach(function (page) {
        var row = document.createElement('div'); row.className = 'page-row';
        var path = document.createElement('span'); path.textContent = page.path;
        var track = document.createElement('div'); track.className = 'page-track';
        var fill = document.createElement('div'); fill.className = 'page-fill'; fill.style.width = page.views / top * 100 + '%'; track.appendChild(fill);
        var count = document.createElement('strong'); count.textContent = page.views; row.append(path, track, count); $('top-pages').appendChild(row);
      });
    }).catch(function (error) { $('tracking-status').className = 'warning'; $('tracking-status').textContent = 'Tracking unavailable: ' + error.message; });
  }
  document.querySelectorAll('.tabs button').forEach(function (button) { button.addEventListener('click', function () { selectTab(button.dataset.tab); }); });
  $('refresh-appointments').addEventListener('click', loadAppointments);
  $('analytics-range').addEventListener('change', loadAnalytics);
  loadLogin();
}());
