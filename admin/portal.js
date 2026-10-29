(function () {
  'use strict';
  var endpoint = 'https://script.google.com/macros/s/AKfycbysLAettKRWslMW8YgG3BxftA2eBL_gsZFdK70bN7B3xu-aG_stqdNqg3jYBB5aqoMa2g/exec';
  var relayEndpoint = window.RALEIGH_BOOKING_RELAY_URL || '';
  var protocol = 'raleigh-chat-booking-v1';
  var credential = sessionStorage.getItem('lirAdminCredential') || '';
  var bridge, pendingAction, armedTransfer;
  var $ = function (id) { return document.getElementById(id); };
  var viewerEmail = '', pendingLoads = {};
  function snapshotKey(kind) { return 'lirPortalSnapshot:v3:' + viewerEmail + ':' + kind; }
  function savedSnapshot(kind) {
    try { var value = JSON.parse(localStorage.getItem(snapshotKey(kind)) || 'null');
      return value && Date.now() - value.savedAt < 7 * 86400000 ? value.result : null;
    } catch (_) { return null; }
  }
  function loadSnapshot(kind, request, render, indicator) {
    var owner = viewerEmail, cacheKey = snapshotKey(kind), saved = savedSnapshot(kind), label = $(indicator);
    if (saved) render(saved);
    if (pendingLoads[kind]) return pendingLoads[kind];
    label.textContent = 'Updating…'; label.className = 'updating';
    pendingLoads[kind] = request().then(function (result) {
      if (viewerEmail !== owner) return;
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), result: result })); } catch (_) {}
      render(result);
      if (kind.indexOf('analytics-') === 0 && kind !== 'analytics-' + $('analytics-range').value) return;
      label.textContent = 'Updated ' + new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(result.generatedAt || Date.now()));
      label.className = 'update-status';
    }).catch(function (error) {
      if (viewerEmail !== owner) return;
      if (kind.indexOf('analytics-') === 0 && kind !== 'analytics-' + $('analytics-range').value) return;
      label.className = 'warning';
      label.textContent = (saved ? 'Showing the last saved view. Update unavailable: ' : 'Data unavailable: ') + error.message;
    }).finally(function () { delete pendingLoads[kind]; });
    return pendingLoads[kind];
  }
  function pageName(path) {
    var names = { '/': 'Home page', '/consult/': 'Consult page', '/buy/': 'Buy page', '/sell/': 'Sell page',
      '/quiz/': 'Suburb quiz landing page', '/2026/': 'Relocation guide landing page', '/learning-center/': 'Learning Center' };
    if (names[path]) return names[path];
    return path.split('/').filter(Boolean).pop().replace(/-/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }
  function duration(seconds) {
    if (seconds == null) return 'Not available';
    var rounded = Math.round(seconds); return Math.floor(rounded / 60) + 'm ' + rounded % 60 + 's';
  }
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
    viewerEmail = result.viewer.email.toLowerCase();
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
    resetTransfer();
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
  function resetTransfer() {
    if (!armedTransfer) return;
    clearTimeout(armedTransfer.timer);
    armedTransfer.button.textContent = armedTransfer.label;
    armedTransfer.button.classList.remove('confirm-transfer');
    armedTransfer.button.setAttribute('aria-pressed', 'false');
    armedTransfer = null;
  }
  function changeHost(appt, host, button) {
    if (button.disabled) return;
    if (!armedTransfer || armedTransfer.button !== button) {
      resetTransfer();
      armedTransfer = { button: button, label: button.textContent, timer: setTimeout(resetTransfer, 15000) };
      button.textContent = 'Click one more time to confirm: ' + host;
      button.classList.add('confirm-transfer');
      button.setAttribute('aria-pressed', 'true');
      return;
    }
    resetTransfer();
    button.disabled = true; button.textContent = 'Updating…'; status('Updating appointment…');
    admin('assignment', { id: appt.id, expectedHost: appt.host, host: host, confirm: true })
      .then(function () { status('Assignment updated.'); loadAppointments(); })
      .catch(function (error) { status(error.message); button.disabled = false; button.textContent = host === 'Both' ? 'Add both hosts' : 'Transfer to ' + host; });
  }
  function cancelAppointment(appt) {
    resetTransfer();
    confirm('Cancel appointment?', 'This will cancel ' + appt.client + '’s appointment on ' + formatTime(appt.start) + '.', false)
      .then(function (ok) { if (!ok) return; return confirm('Final cancellation', 'Type CANCEL to confirm. This removes the calendar event.', true)
        .then(function (sure) { if (!sure) return; status('Cancelling appointment…');
          return admin('cancel', { id: appt.id, confirm: true, confirmText: $('confirm-text').value })
            .then(function () { status('Appointment cancelled.'); loadAppointments(); }); }); })
      .catch(function (error) { status(error.message); });
  }
  function loadAppointments() {
    return loadSnapshot('appointments', function () { return admin('appointments'); }, renderAppointments, 'appointments-updating');
  }
  function renderAppointments(result) {
      resetTransfer();
      var list = $('appointment-list');
      $('rotation').replaceChildren(metric('Benjamin this month', result.counts.Benjamin, result.month),
        metric('Ricardo this month', result.counts.Ricardo, result.month), metric('Next in rotation', result.nextUp, 'When both are available'));
      list.replaceChildren();
      if (!result.appointments.length) { list.textContent = 'No upcoming exploration calls found.'; return; }
      result.appointments.filter(function (appt) { return Date.parse(appt.start) > Date.now(); }).forEach(function (appt) {
        var card = document.createElement('article'); card.className = 'appointment';
        var name = document.createElement('h3'); name.textContent = appt.client || appt.title;
        var time = document.createElement('p'); time.className = 'meta'; time.textContent = formatTime(appt.start);
        var details = document.createElement('div'); details.className = 'detail';
        details.append(detail('Assigned to', appt.host), detail('Meeting', appt.type),
          detail('Pre-call email', appt.emailStatus), detail('Client goal', appt.purpose),
          detail('Email', appt.email), detail('Phone', appt.phone),
          detail('Notes', appt.notes), detail('Attendees', appt.guests.join(', ')));
        if (appt.type === 'Google video call') {
          var meeting = document.createElement('div');
          if (appt.videoUrl && /^https:\/\//i.test(appt.videoUrl)) {
            var meetingLink = document.createElement('a'); meetingLink.href = appt.videoUrl;
            meetingLink.textContent = 'Join video call'; meetingLink.target = '_blank'; meetingLink.rel = 'noopener';
            meeting.appendChild(meetingLink);
          } else meeting.textContent = 'Video link: Not available yet';
          details.appendChild(meeting);
        }
        if (appt.calendarUrl && /^https:\/\//i.test(appt.calendarUrl)) {
          var calendarLink = document.createElement('a'); calendarLink.href = appt.calendarUrl;
          calendarLink.textContent = 'Open calendar event'; calendarLink.target = '_blank'; calendarLink.rel = 'noopener';
          details.appendChild(calendarLink);
        }
        var actions = document.createElement('div'); actions.className = 'actions';
        ['Benjamin', 'Ricardo', 'Both'].filter(function (host) { return host !== appt.host; }).forEach(function (host) {
          actions.appendChild(actionButton(host === 'Both' ? 'Add both hosts' : 'Transfer to ' + host,
            function (event) { changeHost(appt, host, event.currentTarget); }));
        });
        actions.appendChild(actionButton('Cancel appointment', function () { cancelAppointment(appt); }, true));
        card.append(name, time, details, actions); list.appendChild(card);
      });
  }
  function loadAnalytics() {
    var range = $('analytics-range').value;
    return loadSnapshot('analytics-' + range, function () { return admin('analytics', { range: range }); }, function (result) {
      if ($('analytics-range').value === range) renderAnalytics(result);
    }, 'analytics-updating');
  }
  function renderAnalytics(result) {
      $('tracking-status').className = result.stale ? 'warning' : '';
      $('tracking-status').textContent = result.stale ? 'Tracking may be stale. Last real page view: ' + (result.latestReal || 'none found') :
        'Website events · ' + result.start + ' to ' + result.end;
      $('analytics-metrics').replaceChildren(metric('Tracked visits', result.visits, 'Unique sessions'),
        metric('Total leads', result.leads == null ? 'Not available' : result.leads, 'Unique contacts · forms, guide downloads & bookings'),
        metric('Average time on site', duration(result.averageTimeSeconds), 'Tracked visible-tab time'),
        metric('Average pages per visit', result.averagePages == null ? 'Not available' : result.averagePages.toFixed(1), 'Page views per session'),
        metric('Chat conversations', result.chatConversations == null ? 'Not available' : result.chatConversations, 'Conversations with a visitor reply'),
        metric('Chat → booked call', result.chatConversion == null ? 'No conversations yet' : result.chatConversion.toFixed(1) + '%', (result.chatBooked || 0) + ' confirmed bookings'),
        metric('Tracked form enquiries', result.enquiries, 'Sessions with a submission event'),
        metric('Booking-page visitors', result.bookingVisitors, 'Unique visits to the consult page'));
      $('metric-notes').textContent = [result.leadNote, result.timingNote, result.chatNote].filter(Boolean).join(' ');
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
        if (result.series.length === 1) {
          var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          var coordinate = points.split(','); dot.setAttribute('cx', coordinate[0]); dot.setAttribute('cy', coordinate[1]);
          dot.setAttribute('r', '5'); dot.setAttribute('fill', '#2b715b'); chart.appendChild(dot);
        }
      }
      $('visits-chart').replaceChildren(chart);
      var caption = document.createElement('p'); caption.className = 'chart-caption';
      caption.textContent = result.series.length ? result.series[0].date + ' to ' + result.series[result.series.length - 1].date : 'No tracked visits in this range.';
      $('visits-chart').appendChild(caption);
      $('top-pages').replaceChildren();
      var top = Math.max(1, ...result.topPages.map(function (page) { return page.views; }));
      result.topPages.forEach(function (page) {
        var row = document.createElement('div'); row.className = 'page-row';
        var path = document.createElement('span'); path.textContent = pageName(page.path); path.title = page.path;
        var track = document.createElement('div'); track.className = 'page-track';
        var fill = document.createElement('div'); fill.className = 'page-fill'; fill.style.width = page.views / top * 100 + '%'; track.appendChild(fill);
        var count = document.createElement('strong'); count.textContent = page.views; row.append(path, track, count); $('top-pages').appendChild(row);
      });
  }
  document.querySelectorAll('.tabs button').forEach(function (button) { button.addEventListener('click', function () { selectTab(button.dataset.tab); }); });
  $('analytics-range').addEventListener('change', loadAnalytics);
  function refreshActiveView() {
    if (document.visibilityState !== 'visible' || $('workspace').hidden) return;
    if (location.hash === '#appointments') loadAppointments();
    if (location.hash === '#analytics') loadAnalytics();
  }
  setInterval(refreshActiveView, 60000);
  document.addEventListener('visibilitychange', refreshActiveView);
  loadLogin();
}());
