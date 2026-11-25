(function (root) {
  'use strict';
  function normalize(value) { return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function deduplicate(rows) {
    var result = [], ids = new Set(), authors = new Set(), texts = new Set();
    rows.forEach(function (row) {
      if (!row || typeof row.text !== 'string' || !row.text.trim() || !row.author) return;
      var author = row.authorKey || normalize(row.author), text = normalize(row.text);
      if ((row.id && ids.has(row.id)) || authors.has(author) || texts.has(text)) return;
      if (row.id) ids.add(row.id);
      authors.add(author); texts.add(text); result.push(row);
    });
    return result;
  }
  function page(rows, start, size) {
    return Array.from({length: Math.min(size, rows.length)}, function (_, i) { return rows[(start + i) % rows.length]; });
  }
  if (typeof module === 'object' && module.exports) module.exports = {normalize: normalize, deduplicate: deduplicate, page: page};
  if (!root.document) return;
  var section = document.querySelector('[data-client-reviews]');
  if (!section) return;
  var grid = section.querySelector('.home-client-voices-grid');
  var legacy = Array.from(grid.querySelectorAll('.home-client-voice')).map(function (el) {
    return {id: 'testimonial-' + el.dataset.authorKey, authorKey: el.dataset.authorKey,
      author: el.querySelector('strong').textContent, legacy: true,
      text: Array.from(el.querySelectorAll('p:not(.home-client-voice-mark)')).map(function (p) { return p.textContent; }).join('\n\n')};
  });
  var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 8000);
  function load(url, signal) {
    return fetch(url, {signal: signal}).then(function (r) { if (!r.ok) throw new Error('Reviews unavailable'); return r.json(); });
  }
  var endpoint = section.dataset.googleReviewsEndpoint, connected = false;
  try { var endpointUrl = new URL(endpoint); connected = endpointUrl.protocol === 'https:' && /(^|\.)workers\.dev$|(^|\.)raleighncguide\.com$/.test(endpointUrl.hostname); } catch (_) {}
  var dataPromise = connected ? load(endpoint, controller.signal).catch(function () { return load('/assets/data/client-reviews.json'); }) : load('/assets/data/client-reviews.json', controller.signal);
  dataPromise.then(function (data) {
    if (data.version !== 1 || !Array.isArray(data.reviews) || !Array.isArray(data.sources)) return;
    // Provider data is used only while fresh. The original testimonials stay available on failure.
    var fresh = data.mode !== 'google-business-profile' || Date.now() - Date.parse(data.updatedAt) < 30 * 86400000;
    var rows = deduplicate((fresh ? data.reviews : []).concat(legacy));
    if (!rows.length) return;
    var sources = new Map(data.sources.map(function (s) { return [s.id, s]; }));
    var mobile = matchMedia('(max-width: 760px)'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
    var start = 0, userPaused = false, hovered = false, visible = false;
    var controls = section.querySelector('.client-review-controls'), status = controls.querySelector('[role="status"]');
    var pause = controls.querySelector('[data-review-pause]');
    var timer;
    function safeGoogle(url) {
      try { var u = new URL(url); return u.protocol === 'https:' && /(^|\.)google\.com$|^share\.google$/.test(u.hostname) ? u.href : null; } catch (_) { return null; }
    }
    function link(label, url) {
      var a = document.createElement('a'); a.textContent = label; a.href = url;
      a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
    }
    function render(announce) {
      var size = mobile.matches ? 1 : 3;
      grid.replaceChildren();
      page(rows, start, size).forEach(function (row) {
        var card = document.createElement('article'); card.className = 'home-client-voice client-review-card';
        card.dataset.reviewId = row.id;
        var mark = document.createElement('p'); mark.className = 'home-client-voice-mark'; mark.textContent = '“'; mark.setAttribute('aria-hidden','true'); card.append(mark);
        if (!row.legacy && Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5) {
          var stars = document.createElement('p'); stars.className = 'client-review-stars';
          stars.setAttribute('aria-label', row.rating + ' out of 5 stars'); stars.textContent = '★'.repeat(row.rating); card.append(stars);
        }
        var quote = document.createElement('p'), words = row.text.trim().split(/\s+/), shortened = row.legacy && words.length > 48;
        quote.textContent = shortened ? words.slice(0,48).join(' ') + '…' : row.text + (row.excerpt && !/[.!?]$/.test(row.text) ? '…' : ''); card.append(quote);
        if (shortened) {
          var details = document.createElement('details'), summary = document.createElement('summary'), full = document.createElement('p');
          summary.textContent = 'Read full testimonial'; full.textContent = row.text; details.append(summary, full); card.append(details);
        }
        var author = document.createElement('strong');
        var profile = safeGoogle(row.authorUrl || (row.authorKey && /^\d+$/.test(row.authorKey) ? 'https://www.google.com/maps/contrib/' + row.authorKey + '/reviews' : ''));
        if (profile && !row.legacy) author.append(link(row.author, profile)); else author.textContent = row.author;
        card.append(author);
        var attribution = document.createElement('p'); attribution.className = 'client-review-attribution';
        var source = sources.get(row.source), sourceUrl = source && safeGoogle(source.url);
        if (row.legacy) attribution.textContent = 'Client testimonial';
        else if (sourceUrl) attribution.append(link('Google review' + (row.excerpt ? ' excerpt' : '') + ' · ' + source.name, sourceUrl));
        else attribution.textContent = 'Google review excerpt';
        card.append(attribution); grid.append(card);
      });
      section.classList.add('client-reviews-ready'); controls.hidden = rows.length <= size;
      status.textContent = announce ? 'Showing reviews ' + (start + 1) + '–' + (((start + Math.min(size, rows.length) - 1) % rows.length) + 1) + ' of ' + rows.length : '';
    }
    function move(direction, announce) { start = (start + direction * (mobile.matches ? 1 : 3) + rows.length) % rows.length; render(announce); }
    function resetTimer() {
      clearInterval(timer);
      if (userPaused || reduced.matches) return;
      timer = setInterval(function () {
        if (visible && !document.hidden && !hovered && !section.contains(document.activeElement) && !section.querySelector('details[open]')) move(1, false);
      }, 12000);
    }
    controls.querySelector('[data-review-prev]').addEventListener('click', function () { move(-1, true); resetTimer(); });
    controls.querySelector('[data-review-next]').addEventListener('click', function () { move(1, true); resetTimer(); });
    pause.addEventListener('click', function () { userPaused = !userPaused; pause.textContent = userPaused ? 'Play' : 'Pause'; pause.setAttribute('aria-pressed', String(userPaused)); resetTimer(); });
    section.addEventListener('mouseenter', function () { hovered = true; }); section.addEventListener('mouseleave', function () { hovered = false; });
    mobile.addEventListener('change', function () { render(false); });
    reduced.addEventListener('change', resetTimer);
    if ('IntersectionObserver' in root) new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, {threshold: .1}).observe(section);
    else visible = true;
    render(false); resetTimer();
  }).catch(function () { /* Keep the existing, server-rendered testimonials. */ }).finally(function () { clearTimeout(timeout); });
})(typeof window !== 'undefined' ? window : globalThis);
