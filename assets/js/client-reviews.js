(function (root) {
  'use strict';
  function normalize(value) { return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function deduplicate(rows) {
    var result = [], ids = new Set(), authors = new Set(), texts = new Set();
    rows.forEach(function (row) {
      if (!row || (!row.legacy && row.rating !== 5) || typeof row.text !== 'string' || !row.text.trim() || !row.author) return;
      var author = row.authorKey || normalize(row.author), text = normalize(row.text);
      if ((row.id && ids.has(row.id)) || authors.has(author) || texts.has(text)) return;
      if (row.id) ids.add(row.id);
      authors.add(author); texts.add(text); result.push(row);
    });
    return result;
  }
  function displayName(value) { var parts = String(value || '').split(/\s+-\s+/)[0].trim().split(/\s+/); return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.' : parts[0]; }
  function page(rows, start, size) {
    return Array.from({length: Math.min(size, rows.length)}, function (_, i) { return rows[(start + i) % rows.length]; });
  }
  if (typeof module === 'object' && module.exports) module.exports = {normalize: normalize, deduplicate: deduplicate, page: page, displayName: displayName};
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
    var mobile = matchMedia('(max-width: 760px)');
    var start = 0;
    try {
      var key = 'lir-review-session-v1', saved = sessionStorage.getItem(key);
      if (saved === null) {
        start = Number(localStorage.getItem('lir-review-next-v1')) || 0;
        sessionStorage.setItem(key, String(start));
        localStorage.setItem('lir-review-next-v1', String((start + 3) % rows.length));
      } else start = Number(saved) || 0;
    } catch (_) { start = Math.floor(Math.random() * rows.length); }
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
        author.textContent = displayName(row.author); card.append(author);
        var attribution = document.createElement('p'); attribution.className = 'client-review-attribution';
        attribution.textContent = row.legacy ? 'Client testimonial' : 'Google Review';
        card.append(attribution); grid.append(card);
      });
      section.classList.add('client-reviews-ready');
    }
    mobile.addEventListener('change', function () { render(false); });
    render(false);
  }).catch(function () { /* Keep the existing, server-rendered testimonials. */ }).finally(function () { clearTimeout(timeout); });
})(typeof window !== 'undefined' ? window : globalThis);
