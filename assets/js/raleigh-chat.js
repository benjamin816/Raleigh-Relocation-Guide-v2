(function () {
  "use strict";
  var config = window.RaleighChatConfig;
  var engine = window.RaleighChatEngine;
  if (!config || !engine || document.querySelector(".rchat")) return;
  var path = window.location.pathname.replace(/index\.html$/, "");
  if (config.excludedPaths.indexOf(path) !== -1) return;

  var root = document.createElement("aside");
  root.className = "rchat";
  root.setAttribute("aria-label", "Raleigh website help");
  root.innerHTML =
    '<section class="rchat-panel" role="dialog" aria-label="Raleigh website help" aria-modal="false" hidden>' +
      '<header class="rchat-head"><img class="rchat-avatar" alt="" /><span class="rchat-head-copy"><strong class="rchat-head-title"></strong></span><button class="rchat-close" type="button" aria-label="Minimize chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7" /></svg></button></header>' +
      '<div class="rchat-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<button class="rchat-new" type="button" hidden>New message ↓</button>' +
      '<button class="rchat-test-reset" type="button" hidden>Reset test conversation</button>' +
      '<div class="rchat-file-status" hidden><span class="rchat-file-name"></span><button class="rchat-file-remove" type="button" aria-label="Remove attached file">×</button></div>' +
      '<form class="rchat-compose"><textarea class="rchat-input" rows="1" maxlength="2000" aria-label="Type a message" placeholder="Type a Message..." autocomplete="off"></textarea>' +
        '<button class="rchat-tool rchat-mic" type="button" aria-label="Speak a message" title="Speak a message"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8"/></svg></button>' +
        '<button class="rchat-tool rchat-attach" type="button" aria-label="Attach a photo or PDF" title="Attach a photo or PDF"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 11.5-8.6 8.6a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button>' +
        '<input class="rchat-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden />' +
        '<button class="rchat-send" type="submit" aria-label="Send message" disabled>➤</button></form>' +
    '</section>' +
    '<button class="rchat-launch" type="button" aria-label="Open Raleigh help chat" aria-expanded="false">' +
      '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 7h20a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H15l-8 5v-5H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z"/><path d="M10 14h12M10 19h8"/></svg>' +
    '</button>';
  document.body.appendChild(root);

  var panel = root.querySelector(".rchat-panel");
  var launcher = root.querySelector(".rchat-launch");
  var closeButton = root.querySelector(".rchat-close");
  var log = root.querySelector(".rchat-log");
  var newMessageButton = root.querySelector(".rchat-new");
  var testResetButton = root.querySelector(".rchat-test-reset");
  if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) testResetButton.hidden = false;
  var compose = root.querySelector(".rchat-compose");
  var input = root.querySelector(".rchat-input");
  var sendButton = root.querySelector(".rchat-send");
  var microphoneButton = root.querySelector(".rchat-mic");
  var attachmentButton = root.querySelector(".rchat-attach");
  var attachmentInput = root.querySelector(".rchat-file-input");
  var attachmentStatus = root.querySelector(".rchat-file-status");
  var attachmentName = root.querySelector(".rchat-file-name");
  var attachmentRemove = root.querySelector(".rchat-file-remove");
  var attachment = null;
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var speech = null;
  function sizeInput(preserveConversation) {
    var priorLogTop = preserveConversation ? log.scrollTop : null;
    input.style.height = "42px";
    var height = Math.min(Math.max(input.scrollHeight, 42), 142);
    input.style.height = height + "px";
    input.style.overflowY = input.scrollHeight > 142 ? "auto" : "hidden";
    if (priorLogTop !== null) {
      log.scrollTop = priorLogTop;
      window.requestAnimationFrame(function () {
        if (document.activeElement === input && !panel.hidden) log.scrollTop = priorLogTop;
      });
    }
  }
  function stopVoiceTyping() {
    if (!speech) return;
    var current = speech;
    speech = null;
    current.onresult = null;
    current.onend = null;
    current.onerror = null;
    try { current.stop(); } catch (_) { /* Recognition may have already ended. */ }
    microphoneButton.classList.remove("rchat-mic--active");
    microphoneButton.setAttribute("aria-label", "Speak a message");
  }
  var avatar = root.querySelector(".rchat-avatar");
  avatar.src = config.avatar;
  root.querySelector(".rchat-head-title").textContent = config.title;

  var storageKey = "raleigh-guide-chat-v1";
  var storageDays = Number.isInteger(config.conversationMemoryDays) ? Math.max(1, Math.min(config.conversationMemoryDays, 365)) : 180;
  var state = { intent: null, combined: false, question: -1, answers: [], profile: {}, memories: {}, memoryProfiles: {}, history: [], started: false, lastFocus: null, contact: null, booking: null, offTrackOffer: false, submitting: false, ended: false, sentMessageSinceOpen: false, previousInput: "" };
  var safetyKey = "raleigh-guide-chat-safety-v1";
  function safetyRecord(reason) {
    if (window.__livrAnalyticsTracker && typeof window.__livrAnalyticsTracker.track === "function") {
      window.__livrAnalyticsTracker.track("chat_moderation", { moderation_reason: reason, moderation_source: "website_rule_chat" });
    }
    try {
      var saved = JSON.parse(window.localStorage.getItem(safetyKey) || "null") || { strikes: 0, events: [] };
      saved.events = (saved.events || []).concat({ at: new Date().toISOString(), reason: reason }).slice(-20);
      if (reason === "hate" || reason === "threat") saved.strikes = 2;
      else if (reason !== "language") saved.strikes = (saved.strikes || 0) + 1;
      window.localStorage.setItem(safetyKey, JSON.stringify(saved));
      return saved.strikes;
    } catch (_) { return 0; }
  }
  try {
    var priorSafety = JSON.parse(window.localStorage.getItem(safetyKey) || "null");
    if (priorSafety && priorSafety.strikes >= 2 && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) { root.hidden = true; return; }
  } catch (_) { /* Private browsing may disable local storage. */ }
  function redact(text) {
    return String(text).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
      .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone removed]").slice(0, 2000);
  }
  function persist() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 2, updatedAt: Date.now(), started: state.started,
        intent: state.intent, combined: state.combined, question: state.question,
        answers: state.answers.map(redact).slice(0, 12),
        profile: state.profile, memories: state.memories, memoryProfiles: state.memoryProfiles,
        history: state.history.slice(-80)
      }));
    } catch (_) { /* Browsers may block local storage. Chat still works for this visit. */ }
  }
  function showAttachment() {
    attachmentName.textContent = attachment ? attachment.name : "";
    attachmentStatus.hidden = !attachment;
    attachmentButton.setAttribute("aria-label", attachment ? "Replace attached file" : "Attach a photo or PDF");
  }
  function readAttachment(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var value = String(reader.result || "");
        var encoded = value.split(",")[1];
        if (!encoded) reject(new Error("Could not read the attachment."));
        else resolve({ name: file.name, type: file.type, base64: encoded });
      };
      reader.onerror = function () { reject(new Error("Could not read the attachment.")); };
      reader.readAsDataURL(file);
    });
  }
  function restore() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (!saved || (saved.version !== 1 && saved.version !== 2) || !Number.isFinite(saved.updatedAt) ||
          Date.now() - saved.updatedAt > storageDays * 86400000 || saved.updatedAt > Date.now() + 86400000) return;
      state.started = saved.started === true;
      state.intent = saved.version === 2 && Object.prototype.hasOwnProperty.call(config.flows, saved.intent) ? saved.intent : null;
      state.combined = state.intent === "selling" && saved.combined === true;
      state.profile = saved.version === 2 && saved.profile && typeof saved.profile === "object" ? saved.profile : {};
      state.question = Number.isInteger(saved.question) ? Math.max(-1, Math.min(saved.question, state.intent ? activeQuestions().length : -1)) : -1;
      state.answers = saved.version === 2 && Array.isArray(saved.answers) ? saved.answers.filter(function (item) { return typeof item === "string"; }).slice(0, 12).map(redact) : [];
      if (saved.version === 2 && saved.memoryProfiles && typeof saved.memoryProfiles === "object" && !Array.isArray(saved.memoryProfiles)) state.memoryProfiles = saved.memoryProfiles;
      if (saved.version === 2 && saved.memories && typeof saved.memories === "object" && !Array.isArray(saved.memories)) {
        Object.keys(config.flows).forEach(function (id) {
          if (Array.isArray(saved.memories[id])) state.memories[id] = saved.memories[id]
            .filter(function (item) { return typeof item === "string"; }).slice(0, config.flows[id].questions.length).map(redact);
        });
      }
      if (Array.isArray(saved.history)) saved.history.slice(-80).forEach(function (item) {
        if (!item || typeof item.text !== "string" || typeof item.byUser !== "boolean") return;
        var entry = { text: redact(item.text), byUser: item.byUser, at: item.at };
        if (item.link && safeLink(item.link.href) && typeof item.link.label === "string") entry.link = { href: item.link.href, label: item.link.label.slice(0, 80) };
        state.history.push(entry);
        message(entry.text, entry.byUser, { at: entry.at, link: entry.link, restoring: true });
      });
      if (!state.history.length) state.started = false;
    } catch (_) { /* An invalid or unavailable local record is ignored. */ }
  }
  var audioContext;
  function unlockAudio() {
    try {
      var Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext = audioContext || new Audio();
      if (audioContext.state === "suspended") audioContext.resume().catch(function () {});
    } catch (_) { /* The browser may not allow sound. */ }
  }
  function sound() {
    try {
      var Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext = audioContext || new Audio();
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(620, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(850, audioContext.currentTime + .07);
      gain.gain.setValueAtTime(.025, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .1);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + .1);
    } catch (_) { /* Audio may be blocked by the browser. */ }
  }
  function incomingSound() {
    try {
      if (!audioContext || audioContext.state !== "running") return;
      var start = audioContext.currentTime;
      [740, 987].forEach(function (frequency, index) {
        var oscillator = audioContext.createOscillator();
        var gain = audioContext.createGain();
        var at = start + index * .075;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, at);
        gain.gain.setValueAtTime(.0001, at);
        gain.gain.exponentialRampToValueAtTime(.018, at + .015);
        gain.gain.exponentialRampToValueAtTime(.0001, at + .17);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(at);
        oscillator.stop(at + .18);
      });
    } catch (_) { /* Audio may be blocked by the browser. */ }
  }
  var botQueue = Promise.resolve();
  var pendingBotMessages = 0;
  var messageGeneration = 0;
  function queueBotMessage(text, options) {
    var generation = messageGeneration;
    pendingBotMessages += 1;
    input.disabled = true;
    sendButton.disabled = true;
    botQueue = botQueue.then(function () {
      if (generation !== messageGeneration) return;
      var row = document.createElement("div");
      row.className = "rchat-row rchat-row--typing";
      row.setAttribute("aria-label", "Typing");
      var img = document.createElement("img");
      img.src = config.avatar;
      img.alt = "";
      var dots = document.createElement("span");
      dots.className = "rchat-typing-dots";
      dots.setAttribute("aria-hidden", "true");
      dots.innerHTML = "<i></i><i></i><i></i>";
      row.append(img, dots);
      log.appendChild(row);
      if (!panel.hidden) scrollToLatest();
      return new Promise(function (resolve) { window.setTimeout(resolve, 1400); }).then(function () {
        row.remove();
        if (generation === messageGeneration) renderMessage(text, false, options);
      });
    }).finally(function () {
      pendingBotMessages -= 1;
      if (pendingBotMessages === 0 && !state.submitting) {
        input.disabled = state.ended;
        sendButton.disabled = state.ended || !input.value.trim();
      }
    });
  }
  function message(text, byUser, options) {
    options = options || {};
    if (!byUser && !options.restoring) {
      queueBotMessage(text, options);
      return;
    }
    return renderMessage(text, byUser, options);
  }
  function renderMessage(text, byUser, options) {
    options = options || {};
    var row = document.createElement("div");
    row.className = "rchat-row" + (byUser ? " rchat-row--user" : "") + (options.restoring ? " rchat-row--restored" : "");
    if (!byUser) {
      var img = document.createElement("img");
      img.src = config.avatar;
      img.alt = "";
      row.appendChild(img);
    }
    var content = document.createElement("div");
    content.className = "rchat-content";
    var bubble = document.createElement("div");
    bubble.className = "rchat-bubble";
    bubble.textContent = text;
    if (options.link && safeLink(options.link.href)) {
      var anchor = document.createElement("a");
      anchor.className = "rchat-link";
      anchor.href = options.link.href;
      anchor.textContent = options.link.label;
      bubble.appendChild(anchor);
    }
    var timestamp = document.createElement("time");
    var now = options.at && !isNaN(Date.parse(options.at)) ? new Date(options.at) : new Date();
    timestamp.className = "rchat-time";
    timestamp.dateTime = now.toISOString();
    timestamp.textContent = now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    bubble.appendChild(timestamp);
    content.appendChild(bubble);
    row.appendChild(content);
    log.appendChild(row);
    if (!byUser && !options.restoring) incomingSound();
    if (!options.restoring && !panel.hidden) scrollToLatest();
    if (!options.restoring && options.remember !== false && !state.contact && !state.booking) {
      state.history.push({ text: redact(text), byUser: !!byUser, at: now.toISOString(), link: options.link || null });
      state.history = state.history.slice(-80);
      persist();
    }
    return bubble;
  }
  function safeLink(href) {
    return typeof href === "string" && /^\/(?!\/)[a-z0-9\-_/]*$/i.test(href) ? href : null;
  }
  var bookingBridge = null;
  function bookingToken() {
    var values = new Uint8Array(16);
    window.crypto.getRandomValues(values);
    return Array.from(values).map(function (value) { return value.toString(16).padStart(2, "0"); }).join("");
  }
  function bookingBridgeReady() {
    var url = config.bookingBridgeUrl || "";
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
      return Promise.reject(new Error("Chat booking is not connected yet."));
    }
    if (bookingBridge) return bookingBridge.ready;
    var channel = bookingToken();
    var frame = document.createElement("iframe");
    // Keep Google account cookies out of the public web app request. A visitor
    // may have several signed-in Google accounts, and Apps Script otherwise
    // redirects the iframe to an account-specific URL that can fail to load.
    frame.credentialless = true;
    frame.hidden = true;
    frame.title = "Secure booking service";
    frame.src = url + "?channel=" + channel;
    var pending = {};
    var resolveReady, rejectReady;
    var ready = new Promise(function (resolve, reject) { resolveReady = resolve; rejectReady = reject; });
    bookingBridge = { ready: ready, pending: pending, source: null, origin: null, channel: channel };
    window.addEventListener("message", function (event) {
      var googleOrigin = event.origin === "https://script.google.com" || /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com$/i.test(event.origin);
      if (!googleOrigin || !event.data || event.data.protocol !== "raleigh-chat-booking-v1" || event.data.channel !== channel) return;
      if (event.data.ready) {
        bookingBridge.source = event.source;
        bookingBridge.origin = event.origin;
        resolveReady();
        return;
      }
      var request = pending[event.data.requestId];
      if (!request || event.source !== bookingBridge.source) return;
      delete pending[event.data.requestId];
      window.clearTimeout(request.timer);
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data.result);
    });
    frame.addEventListener("error", function () { rejectReady(new Error("Booking service could not load.")); });
    document.body.appendChild(frame);
    window.setTimeout(function () { if (!bookingBridge.source) rejectReady(new Error("Booking service timed out.")); }, 15000);
    return ready;
  }
  function bookingCall(method, args) {
    return bookingBridgeReady().then(function () {
      return new Promise(function (resolve, reject) {
        var id = bookingToken();
        var timer = window.setTimeout(function () {
          delete bookingBridge.pending[id];
          reject(new Error("Booking service took too long."));
        }, 25000);
        bookingBridge.pending[id] = { resolve: resolve, reject: reject, timer: timer };
        bookingBridge.source.postMessage({ protocol: "raleigh-chat-booking-v1", channel: bookingBridge.channel, requestId: id, method: method, args: args || [] }, bookingBridge.origin);
      });
    });
  }
  function bookingLabel(start) {
    return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(start));
  }
  function normalizeSuggestedTime(value) {
    var dated = /\b(\d{4}-\d\d-\d\d\s+\d{1,2}(?::\d\d)?\s*(?:am|pm)(?:\s*(?:ET|Eastern))?)\b/i.exec(value);
    if (dated) return dated[1];
    var match = /\b(today|tomorrow|next\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(value);
    if (!match) return value;
    var parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", weekday: "long" }).formatToParts(new Date()).map(function (part) { return [part.type, part.value]; }));
    var date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    if (/^tomorrow$/i.test(match[1])) date.setUTCDate(date.getUTCDate() + 1);
    else if (!/^today$/i.test(match[1])) {
      var weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      var wanted = weekdays.findIndex(function (day) { return day.startsWith(match[1].replace(/^next\s+/i, "").toLowerCase().slice(0, 3)); });
      if (wanted < 0) return value;
      var ahead = (wanted - date.getUTCDay() + 7) % 7;
      date.setUTCDate(date.getUTCDate() + (ahead || 7));
    }
    return date.toISOString().slice(0, 10) + " " + match[2] + (match[3] ? ":" + match[3] : "") + match[4].toLowerCase() + " ET";
  }
  function bookingPreferenceFromText(value, current) {
    var next = Object.assign({ host: "", daypart: "", weekdays: [], date: "" }, current || {});
    if (/\b(no preference|any time|any day|whoever is available)\b/i.test(value)) return { host: "", daypart: "", weekdays: [], date: "" };
    if (/\b(?:benjamin|ben)\b/i.test(value) && !/\bricardo\b/i.test(value)) next.host = "Benjamin";
    if (/\bricardo\b/i.test(value) && !/\b(?:benjamin|ben)\b/i.test(value)) next.host = "Ricardo";
    if (/\bmornings?\b/i.test(value)) next.daypart = "morning";
    if (/\bafternoons?\b/i.test(value)) next.daypart = "afternoon";
    if (/\bevenings?\b|\bafter (?:5|five)\b/i.test(value)) next.daypart = "evening";
    if (/\bweekends?\b/i.test(value)) { next.weekdays = [0, 6]; next.date = ""; }
    else if (/\bweekdays?\b/i.test(value)) { next.weekdays = [1, 2, 3, 4, 5]; next.date = ""; }
    else {
      var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      var requested = days.map(function (day, index) { return new RegExp("\\b" + day + "s?\\b", "i").test(value) ? index : -1; }).filter(function (day) { return day >= 0; });
      if (requested.length) { next.weekdays = requested; next.date = ""; }
    }
    var exactDate = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(value);
    if (exactDate) { next.date = exactDate[1]; next.weekdays = []; }
    if (/\btomorrow\b/i.test(value) || /\btoday\b/i.test(value)) {
      var parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date()).map(function (part) { return [part.type, part.value]; }));
      var day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
      if (/\btomorrow\b/i.test(value)) day.setUTCDate(day.getUTCDate() + 1);
      next.date = day.toISOString().slice(0, 10);
      next.weekdays = [];
    }
    return next;
  }
  function hasBookingPreference(value) {
    return /\b(?:benjamin|ben|ricardo|morning|afternoon|evening|weekend|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday|tomorrow|today|after (?:5|five))s?\b/i.test(value) || /\b20\d{2}-\d{2}-\d{2}\b/.test(value);
  }
  function bookingFailed(error) {
    state.booking = null;
    message("I can't confirm a calendar time right now. I can pass your details to the team instead, or you can call us at 919-737-7896.", false);
    if (window.console && error) console.warn("Chat booking unavailable:", error.message || error);
  }
  function offerBookingSlots(slots) {
    if (!state.booking) return;
    state.booking.allSlots = Array.isArray(slots) ? slots.slice(0, 6) : [];
    state.booking.offset = 0;
    showBookingPair();
  }
  function showBookingPair() {
    if (!state.booking) return;
    state.booking.slots = state.booking.allSlots.slice(state.booking.offset, state.booking.offset + 2);
    state.booking.step = "choose";
    if (!state.booking.slots.length) {
      message("I don't see an open call time right now. You can leave a message for the team or call 919-737-7896.", false);
      state.booking = null;
      return;
    }
    message("We have " + state.booking.slots.map(function (slot, index) {
      return (index === 0 ? "" : " or ") + bookingLabel(slot.start);
    }).join("") + (config.chatRoundRobinBookingEnabled
      ? ". " + (config.bookingChoicePrompt || "Which works better? You can also ask for mornings, weekends, a specific day, Benjamin or Ricardo, or more times.")
      : ". Which works better? You can also say 'more times' or suggest a day and time."), false);
  }
  function startBooking(request) {
    var currentFlow = state.intent && config.flows[state.intent];
    if (currentFlow && currentFlow.booking === "investing") {
      message("Investing calls are booked through our investor page, where you can choose the time that works for you.", false);
      link("Book an investing exploration call", config.bookingLinks.investing);
      return;
    }
    if (!config.bookingBridgeUrl) {
      message("I can't check the calendar from chat right now. I can pass your details to the team, or you can call 919-737-7896.", false);
      return;
    }
    if (state.booking) return;
    var earlierHostRequest = !request && state.history.slice(-12).reverse().find(function (entry) {
      return entry.byUser && Date.now() - Date.parse(entry.at) < 2 * 3600000 &&
        /\b(?:prefer|request|book|speak|meet|call|work with)\b.{0,60}\b(?:benjamin|ben|ricardo)\b/i.test(entry.text);
    });
    var requestedPreference = bookingPreferenceFromText(request || (earlierHostRequest && earlierHostRequest.text) || "");
    if (!config.chatRoundRobinBookingEnabled && requestedPreference.host) {
      message("I can't guarantee a call with a specific team member from chat yet. Please call 919-737-7896 and we'll find a time with " + requestedPreference.host + ".", false);
      return;
    }
    state.booking = { step: "format", slots: [], allSlots: [], offset: 0, details: {},
      preference: requestedPreference };
    if (/\b(phone|telephone)\b/i.test(request || "")) state.booking.details.callType = "phone";
    else if (config.chatVideoBookingEnabled && /\b(video|zoom|google meet|virtual)\b/i.test(request || "")) state.booking.details.callType = "video";
    if (state.booking.details.callType) { loadBookingSlots(state.booking); return; }
    message(config.bookingPrompt || "Would a video or phone call work better for you?", false);
  }
  function loadBookingSlots(booking) {
    var followUp = booking.step === "choose";
    booking.step = "loading";
    message(followUp ? "Let me check." : "Awesome. Let me check the team's next openings.", false);
    bookingCall("slots", config.chatRoundRobinBookingEnabled ? [booking.preference] : []).then(function (slots) {
      if (state.booking === booking) offerBookingSlots(slots);
    }).catch(function (error) {
      if (state.booking === booking) bookingFailed(error);
    });
  }
  function handleBookingAnswer(value) {
    var booking = state.booking;
    if (/^(cancel|stop|never mind)$/i.test(value)) {
      state.booking = null;
      message("No call was booked. What else can I help with?", false);
      return;
    }
    if (booking.step === "format") {
      booking.preference = bookingPreferenceFromText(value, booking.preference);
      if (!config.chatRoundRobinBookingEnabled && booking.preference.host) {
        state.booking = null;
        message("I can't guarantee a call with a specific team member from chat yet. Please call 919-737-7896 and we'll find a time with " + booking.preference.host + ".", false);
        return;
      }
      if (/\b(video|zoom|meet|virtual)\b/i.test(value)) {
        if (!config.chatVideoBookingEnabled) {
          message("Video invitations are still being connected on Test. I can book a phone call now, or you can leave the team a message about a video call.", false);
          return;
        }
        booking.details.callType = "video";
      }
      else if (/\b(phone|telephone|call me)\b/i.test(value)) booking.details.callType = "phone";
      else { message("Would you prefer a video call or a phone call?", false); return; }
      loadBookingSlots(booking);
      return;
    }
    if (booking.step === "loading") { message("I'm still checking the calendar. One moment, please.", false); return; }
    if (booking.step === "choose") {
      if (!config.chatRoundRobinBookingEnabled && /\b(?:benjamin|ben|ricardo)\b/i.test(value)) {
        message("I can't guarantee a specific team member from chat yet. Please call 919-737-7896 if you'd like to meet with Benjamin or Ricardo.", false);
        return;
      }
      if (config.chatRoundRobinBookingEnabled && hasBookingPreference(value)) {
        booking.preference = bookingPreferenceFromText(value, booking.preference);
      }
      if (config.chatRoundRobinBookingEnabled && hasBookingPreference(value) && !/^\d{4}-\d\d-\d\d\s+\d/i.test(value) &&
          !/\b(?:at\s+)?\d{1,2}(?::\d\d)?\s*(?:am|pm)\b/i.test(value)) {
        loadBookingSlots(booking);
        return;
      }
      if (/^(more|more times|other times|another time|different time)$/i.test(value)) {
        booking.offset = booking.offset + 2 < booking.allSlots.length ? booking.offset + 2 : 0;
        showBookingPair();
        return;
      }
      var choiceText = value.replace(/\s+(?:with|for)\s+(?:benjamin|ben|ricardo)$/i, "").trim();
      var choiceIndex = /^(1|one|first|the first one)$/i.test(choiceText) ? 0 : /^(2|two|second|the second one)$/i.test(choiceText) ? 1 : -1;
      var choice = choiceIndex >= 0 ? booking.slots[choiceIndex] : null;
      if (choice) {
        if (config.chatRoundRobinBookingEnabled && booking.preference.host &&
            Array.isArray(choice.availableHosts) && choice.availableHosts.indexOf(booking.preference.host) === -1) {
          message("I'll find a time when " + booking.preference.host + " is available.", false);
          loadBookingSlots(booking);
          return;
        }
        booking.start = choice.start;
        booking.step = "email";
        message("Great, " + bookingLabel(booking.start) + " for a " + booking.details.callType + " call. " + (config.bookingEmailPrompt || "What's your email address for the invitation?"), false);
        return;
      }
      booking.step = "checking";
      bookingCall("suggest", config.chatRoundRobinBookingEnabled
        ? [normalizeSuggestedTime(value), { host: booking.preference.host }]
        : [normalizeSuggestedTime(value)]).then(function (result) {
        if (!state.booking || state.booking !== booking) return;
        if (!result || !result.available) {
          booking.step = "choose";
          message("That time isn't available. You can choose 1 or 2, ask for more times, or suggest a time like Tuesday at 3pm Eastern.", false);
          return;
        }
        booking.start = result.start;
        booking.step = "email";
        message("That works: " + bookingLabel(booking.start) + ". " + (config.bookingEmailPrompt || "What's your email address for the invitation?"), false);
      }).catch(function (error) { if (state.booking === booking) bookingFailed(error); });
      return;
    }
    if (booking.step === "checking" || booking.step === "confirming") {
      message("One moment while I check that.", false); return;
    }
    if (booking.step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 200) { message("Could you check that email address?", false); return; }
      booking.details.email = value;
      booking.step = "phone";
      message(config.bookingPhonePrompt || "What phone number should we use for the call?", false);
      return;
    }
    if (booking.step === "phone") {
      if (value.replace(/\D/g, "").length < 10 || value.length > 30) { message("Could you enter a phone number with at least 10 digits?", false); return; }
      booking.details.phone = value;
      booking.step = "name";
      message(config.bookingNamePrompt || "What's your full name?", false);
      return;
    }
    if (booking.step === "name") {
      if (value.trim().split(/\s+/).length < 2 || value.length > 100) { message("Could you enter your first and last name?", false); return; }
      booking.details.name = value;
      booking.step = "notes";
      message("Anything you'd like us to know before the call? You can type skip.", false);
      return;
    }
    if (booking.step === "notes") {
      booking.details.notes = /^skip$/i.test(value) ? "" : value.slice(0, 1000);
      booking.step = "confirming";
      booking.requestId = booking.requestId || bookingToken();
      message("I'll book that time now and send the invitation to your email.", false);
      bookingCall("book", [{ requestId: booking.requestId, start: booking.start, name: booking.details.name, email: booking.details.email, phone: booking.details.phone, notes: booking.details.notes, callType: booking.details.callType, preferredHost: config.chatRoundRobinBookingEnabled ? booking.preference.host : "" }]).then(function (result) {
        if (state.booking !== booking) return;
        if (!result || !result.booked) throw new Error("Booking was not confirmed.");
        state.booking = null;
        try { window.localStorage.setItem("livrBookingReportedAt", new Date().toISOString()); } catch (_) {}
        window.dispatchEvent(new CustomEvent("raleigh-booking-confirmed", { detail: { source: "website_chat" } }));
        message("Great, " + booking.details.name.split(/\s+/)[0] + ", I've got you confirmed for " + bookingLabel(result.start) + " with " + (result.assignedHost || "the team") + ". You'll get a calendar invitation." + (booking.details.callType === "video" ? (result.videoUrl ? " The Google Meet link is in the invitation." : " The team will add the video link before your call.") : "") + (result.preCallEmailSent ? " Look out for an email titled What To Know Before Our Call, with a quick form and resources to help you prepare." : "") + " If you need anything in the meantime, message me here or call or text the team at 919-737-7896.", false);
      }).catch(function (error) {
        if (state.booking !== booking) return;
        if (error && /time was taken|choose another|no longer available/i.test(error.message || "")) {
          booking.step = "loading";
          message("That time was just taken. I'll check for another opening.", false);
          bookingCall("slots", config.chatRoundRobinBookingEnabled ? [booking.preference] : []).then(offerBookingSlots).catch(bookingFailed);
          return;
        }
        booking.step = "notes";
        message((error && error.message) || "I couldn't book that time. Please try again, leave a message for the team, or call 919-737-7896.", false);
      });
      return;
    }
  }
  function link(label, href) {
    var url = safeLink(href);
    if (!url) return;
    message("Here's the page: ", false, { link: { label: label, href: url } });
  }
  function detectIntent(text) {
    return engine.detectIntent(text, config);
  }
  function activeQuestions() {
    if (!state.intent || !config.flows[state.intent]) return [];
    return engine.activeQuestions(config.flows[state.intent], state.profile, state.combined);
  }
  function memorySummary(id) {
    var flow = config.flows[id];
    var answers = state.memories[id] || [];
    if (!flow || !answers.length) return "";
    var questions = id === state.intent ? activeQuestions() : engine.activeQuestions(flow, state.memoryProfiles[id] || {}, false);
    return answers.slice(0, Math.min(3, questions.length)).map(function (answer, index) {
      return "You told me “" + answer + "” about “" + questions[index].text + "”.";
    }).join(" ");
  }
  function startFlow(id, fresh, combined, sourceText) {
    var flow = config.flows[id];
    if (!flow) return;
    state.intent = id;
    state.combined = id === "selling" && combined === true;
    if (!fresh && state.memories[id] && state.memories[id].length) {
      state.profile = Object.assign({}, state.memoryProfiles[id] || {});
      state.answers = state.memories[id].slice();
      state.question = Math.min(state.answers.length, activeQuestions().length);
      message("I remember what you've shared about " + id + ". " + memorySummary(id), false);
      if (state.question < activeQuestions().length) askQuestion();
      else if (flow.booking === "general") startBooking();
      else link("Book an investing exploration call", config.bookingLinks.investing);
      return;
    }
    state.question = 0;
    state.answers = [];
    state.profile = {};
    var knownLocation = /^(buying|relocating|investing)$/.test(id) && sourceText && engine.detectLocation(sourceText);
    if (knownLocation) {
      state.profile.location = knownLocation.type;
      state.profile.origin = knownLocation.place || "";
      state.answers.push(redact(sourceText));
      state.question = 1;
      state.memories[id] = state.answers.slice();
      state.memoryProfiles[id] = Object.assign({}, state.profile);
    }
    if (!knownLocation) message(state.combined && flow.combinedIntro ? flow.combinedIntro : flow.intro, false);
    askQuestion(knownLocation ? locationAcknowledgement(knownLocation) : "");
  }
  function locationAcknowledgement(location) {
    if (state.intent === "investing") return location.type === "local" ? "Great!" : "Awesome.";
    if (location.type === "local") return "Great.";
    var place = (location.place || "").toLowerCase();
    return (config.originAcknowledgements || {})[place] || "Awesome. Thanks for sharing where you're moving from.";
  }
  function askQuestion(prefix) {
    var flow = config.flows[state.intent];
    var questions = activeQuestions();
    if (state.question >= questions.length) {
      message(flow.finish, false);
      if (flow.booking === "general") startBooking();
      else link("Book an investing exploration call", config.bookingLinks.investing);
      return;
    }
    var question = questions[state.question];
    var variants = [question.text].concat(Array.isArray(question.alternatives) ? question.alternatives.filter(Boolean) : []);
    var wording = variants[state.answers.length % variants.length] || question.text;
    if (question.key === "areasReason" && state.profile.areasPlural) wording = "What was it about those areas that stood out to you?";
    message((prefix ? prefix + " " : "") + wording, false);
  }
  function answerAcknowledgement(question, answer) {
    if (!question) return "Got it.";
    var text = String(answer || "").toLowerCase();
    switch (question.key) {
      case "currentArea": return /north raleigh/.test(text) ? "North Raleigh is a great area!" : "Okay, great.";
      case "firstTime": return /\b(yes|first|never)\b/.test(text) ? "That's super exciting!" : "Got it.";
      case "leaseEnd": return "Got it.";
      case "whyRaleigh": return /\b(warm|weather|commute)\b/.test(text) ? "That makes sense!" : "I totally understand.";
      case "familyNearby": return /\b(yes|yeah|they do|here|raleigh|cary)\b/.test(text) ? "That's wonderful!" : "Got it.";
      case "currentHome": return /north raleigh/.test(text) ? "North Raleigh is a great area!" : "Okay, great.";
      case "ownedYears": { var years = parseInt(text, 10); return years >= 5 || /\b(five|six|seven|eight|nine|ten|eleven|twelve)\b/.test(text) ? "Wow, you've been there a while!" : "Okay, got it."; }
      case "whySell": case "whySellSolo": return /\b(family|relatives)\b/.test(text) ? "I totally understand." : "That makes sense.";
      case "nextDestination": return "That's exciting!";
      case "nextAreaReason": return "I can see why that appeals to you.";
      case "experience": return /\b(first|new|never)\b/.test(text) ? "That's super exciting!" : "Great, good to know.";
      case "strategy": return "Okay, got it.";
      case "sellingExperience": return /\b(first|never)\b/.test(text) ? "Okay, wonderful." : "Great, good to know.";
      case "timing": return /\b(spring|summer|fall|winter|next year)\b/.test(text) ? "Totally get it." : "Great, that timing makes sense.";
      case "priorities": return "Absolutely!";
      case "areas": return state.profile.areasNeedFollowup ?
        (state.profile.areasPlural ? "Awesome, those are great areas!" : "Awesome, that's a great area!") : "That makes sense!";
      case "areasReason": return "Makes perfect sense!";
      case "home": return state.profile.budgetKnown ? "That gives me a good picture!" : "Got it.";
      case "nextHome": return "That gives me a better picture.";
      case "budget": return state.profile.budgetKnown ? "Awesome!" : "That's totally fine. We can connect you with a lender to get a clearer picture of your buying power.";
      case "financing": return "Great!";
      default: return "Got it.";
    }
  }
  function acceptAnswer(answer) {
    var question = activeQuestions()[state.question];
    var flowQuestions = config.flows[state.intent].questions;
    var questionPosition = flowQuestions.indexOf(question);
    var acknowledgement = answerAcknowledgement(question, answer);
    if (question && question.key === "location") {
      var location = engine.detectLocation(answer);
      if (!location && /^(?:raleigh|cary|durham|the triangle|north carolina|nc)$/i.test(answer.trim())) location = { type: "local", place: "" };
      if (!location && /^[A-Za-z][A-Za-z .-]{1,35}$/.test(answer.trim()) && !/^(?:not sure|i don't know|maybe|yes|no)$/i.test(answer.trim())) location = { type: "out", place: answer.trim().toLowerCase() };
      if (!location) { message("Are you already local to Raleigh, or would you be moving from out of state?", false); return; }
      state.profile.location = location.type;
      state.profile.origin = location.place || "";
      acknowledgement = locationAcknowledgement(location);
    }
    if (question && question.key === "tenure") {
      var tenure = engine.detectTenure(answer);
      if (!tenure) { message("Are you currently renting or do you own your home?", false); return; }
      state.profile.tenure = tenure;
      acknowledgement = tenure === "renting" ? "Okay, great." : "Got it.";
    }
    if (question && question.key === "willSell" && /^(?:yes|yeah|yep|probably|likely|we (?:will|need to|plan to)|i (?:will|need to|plan to))/i.test(answer.trim())) {
      state.intent = "selling";
      state.combined = true;
      state.question = 0;
      state.answers = [];
      state.profile = {};
      message("Got it. Let's plan your sale and next purchase together.", false);
      askQuestion();
      return;
    }
    if (question && question.key === "whyRaleigh") {
      state.profile.familyNearby = /\b(family|relatives|friends)\b/i.test(answer);
      state.profile.prioritiesKnown = /\bcommute\b/i.test(answer);
    }
    if (question && question.key === "areas" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.areasPlural = /,|\band\b|\bor\b|\//i.test(answer);
      state.profile.areasNeedFollowup = !/\b(?:because|since|near|close to|closer to|for the|for its|for their|due to|like the|love the|drawn to|appeals? to|commute|schools?|walkab|yard|family)\b/i.test(answer);
    }
    if (question && question.key === "home" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.budgetKnown = /\$\s?\d{3,7}|\b\d{3,4}\s?k\b|\b\d{6,7}\b/i.test(answer) && !/\b(?:not sure|don't know|unsure)\b/i.test(answer);
    }
    if (question && question.key === "budget" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.budgetKnown = !/\b(?:not sure|don't know|unsure|no idea|haven't decided|need a lender)\b/i.test(answer);
    }
    if (question && question.key !== "location" && question.key !== "tenure") {
      acknowledgement = answerAcknowledgement(question, answer);
    }
    state.answers.push(redact(answer));
    state.memories[state.intent] = state.answers.slice();
    state.memoryProfiles[state.intent] = Object.assign({}, state.profile);
    var nextQuestions = activeQuestions();
    state.question = nextQuestions.findIndex(function (candidate) {
      return flowQuestions.indexOf(candidate) > questionPosition;
    });
    if (state.question < 0) state.question = nextQuestions.length;
    askQuestion(acknowledgement);
  }
  function showContact() {
    // The existing website receiver writes to the Living in Raleigh sheet.
    // Investor enquiries must never be sent there while a separate,
    // acknowledged investor receiver is not configured for this widget.
    if (state.intent === "investing" || /^\/invest(?:\/|$)/i.test(window.location.pathname)) {
      message("For an investing question, use the message form in our calculator. You can also book an investing exploration call.", false);
      link("Send an investing question", config.investorQuestionUrl || "/calculator/");
      link("Book an investing call", config.bookingLinks.investing);
      return;
    }
    state.contact = {
      step: 0,
      data: {},
      submissionId: "website-chat-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    };
    message(config.contactPrompt, false);
    message(config.contactQuestions[0].prompt, false);
    input.maxLength = 100;
  }
  function submitContact() {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.leadEndpoint || "")) {
      message("I can't send contact requests right now. Please use the booking link instead.", false);
      state.contact = null;
      return;
    }
    var contact = state.contact;
    var details = contact.data;
    var nameParts = details.name.split(/\s+/);
    var payload = {
      lead_type: "requested_contact",
      source_key: "website_rule_chat",
      source_page: window.location.pathname,
      requested_contact_source: "Website rule-based chat",
      requested_contact_intent: state.intent || "general",
      requested_contact_notes: "Question: " + details.question + "\nConversation: " + state.answers.join(" / "),
      first_name: nameParts.shift() || "",
      last_name: nameParts.join(" "),
      email: details.email,
      phone: details.phone,
      consent_to_contact: true,
      submission_id: contact.submissionId
    };
    state.submitting = true;
    input.disabled = true;
    sendButton.disabled = true;
    message("Sending your request now...", false);
    (attachment ? readAttachment(attachment).then(function (file) { payload.chat_attachment = file; }) : Promise.resolve()).then(function () { return window.fetch(config.leadEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload)
    }); }).then(function () {
      state.contact = null;
      attachment = null;
      attachmentInput.value = "";
      showAttachment();
      message("Your request was submitted for processing. Thank you!", false);
      window.dispatchEvent(new CustomEvent("raleigh-lead-form-submitted", { detail: { source: "website_chat" } }));
      input.maxLength = 2000;
    }).catch(function () {
      message("I couldn't submit that request. Reply yes to retry or no to cancel.", false);
    }).finally(function () {
      state.submitting = false;
      input.disabled = pendingBotMessages > 0;
      sendButton.disabled = input.disabled || !input.value.trim();
      if (!input.disabled) input.focus();
    });
  }
  function handleContactAnswer(value) {
    var contact = state.contact;
    var step = contact.step;
    if (step >= config.contactQuestions.length) {
      if (/^(yes|yes please|i agree|submit)$/i.test(value)) submitContact();
      else if (/^(no|cancel)$/i.test(value)) {
        state.contact = null;
        attachment = null;
        attachmentInput.value = "";
        showAttachment();
        input.maxLength = 2000;
        message("No details were sent. What else can I help with?", false);
      } else message("Please reply yes to submit or no to cancel.", false);
      return;
    }
    var item = config.contactQuestions[step];
    var valid = true;
    if (item.key === "name") valid = value.length >= 2 && value.length <= 100;
    if (item.key === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
    if (item.key === "phone") valid = value.replace(/\D/g, "").length >= 10 && value.length <= 30;
    if (item.key === "question") valid = value.length >= 3 && value.length <= 2000;
    if (!valid) {
      message(item.retry || "Could you try that again?", false);
      return;
    }
    contact.data[item.key] = value;
    contact.step += 1;
    if (contact.step < config.contactQuestions.length) {
      var next = config.contactQuestions[contact.step];
      message(next.prompt, false);
      input.maxLength = next.key === "question" ? 2000 : next.key === "email" ? 200 : 30;
    } else {
      message(config.contactConsentPrompt, false);
      input.maxLength = 30;
    }
  }
  function handleText(text) {
    var value = text.trim();
    if (!value || state.submitting || state.ended) return;
    state.sentMessageSinceOpen = true;
    try { window.sessionStorage.setItem("livrChatQuietUntil", String(Date.now() + 30 * 60 * 1000)); } catch (_) {}
    if (/^(forget|forget me|clear chat|delete chat history)$/i.test(value)) {
      clearConversation();
      message("This browser's chat history is cleared. What would you like to discuss?", false, { remember: false });
      sound();
      return;
    }
    var safety = engine.classifySafety(value, state.previousInput);
    state.previousInput = value;
    var strikes = safety ? safetyRecord(safety) : 0;
    if (safety && safety !== "language") {
      message(value, true, { remember: false });
      sound();
      if (strikes >= 2 || safety === "hate" || safety === "threat") {
        state.ended = true;
        input.disabled = true;
        sendButton.disabled = true;
        message(config.safetyEnd || "I'm going to end this conversation for now.", false, { remember: false });
      } else if (safety === "discrimination") {
        message("I can compare areas by budget, commute, homes, and amenities. " + (state.intent && state.question < activeQuestions().length ? activeQuestions()[state.question].text : config.safetyWarning), false, { remember: false });
      } else message(config.safetyWarning || "Let's keep this focused on your real estate question.", false, { remember: false });
      return;
    }
    var contactCommand = /^(contact|send a message|ask a question|talk to someone|speak to someone|human)$/i.test(value);
    message(value, true, { remember: !state.contact && !contactCommand });
    sound();
    var faq = engine.findFaq(value, config);
    if (state.booking) {
      if (faq && state.booking.step !== "email" && state.booking.step !== "phone" && state.booking.step !== "name") {
        message(faq.answer, false);
        if (state.booking.step === "format") message(config.bookingPrompt, false);
        else if (state.booking.step === "choose") showBookingPair();
      } else handleBookingAnswer(value);
      return;
    }
    if (state.contact) { handleContactAnswer(value); return; }
    if (state.offTrackOffer) {
      state.offTrackOffer = false;
      if (/^(yes|yes please|sure|okay|ok|please do)$/i.test(value)) { startBooking(value); return; }
      if (/^(no|no thanks|not now|later)$/i.test(value)) { if (state.intent && state.question < activeQuestions().length) askQuestion(); else message(config.fallback, false); return; }
    }
    if (contactCommand) {
      showContact();
      return;
    }
    if (!state.intent && /\b(?:looking to rent|want to rent|need to rent|rent a (?:home|house|apartment)|looking for a rental|just renting)\b/i.test(value)) {
      message("A lot of people rent first to get to know the area. We don't have a rental search service, since most local rentals aren't listed through the MLS. Our free Raleigh guides and YouTube videos can help you get started. When you're ready to buy, come back and we'll help you make a game plan for a more permanent home.", false);
      link("Explore Raleigh guides", "/learning-center/");
      return;
    }
    if (/^(start over|restart|reset)$/i.test(value)) {
      if (state.intent) {
        var previous = state.intent;
        var combined = state.combined;
        delete state.memories[previous];
        startFlow(previous, true, combined);
      } else message(config.welcome, false);
      return;
    }
    if (/^(what do you remember|what did i tell you|my details)$/i.test(value)) {
      var remembered = Object.keys(state.memories).filter(function (id) { return state.memories[id].length; });
      message(remembered.length ? remembered.map(memorySummary).join(" ") : "I don't have any earlier answers saved on this browser yet.", false);
      return;
    }
    if (/^(book|book a call|schedule|schedule a call|appointment|talk to the team)$/i.test(value)) {
      startBooking(value);
      return;
    }
    var detected = detectIntent(value);
    if (/\bcalculator\b/i.test(value) && (state.intent === "investing" || detected && detected.id === "investing")) {
      message("Yes, the investment calculator can help you run the numbers for different strategies.", false);
      link("Open the investment calculator", config.flows.investing.secondaryLink.href);
      if (state.intent && state.question < activeQuestions().length) askQuestion();
      return;
    }
    if (engine.wantsResources(value)) {
      var resourceId = detected ? detected.id : state.intent;
      var resource = resourceId && config.flows[resourceId] && config.flows[resourceId].resourceLink;
      if (resource) {
        message(resourceId === "selling" ? "Great, we have resources for Raleigh sellers on our site." : resourceId === "investing" ? "Great, our Investing in Raleigh resources are here." : "Great, our buying page is a helpful place to start.", false);
        link(resource.label, resource.href);
        if (state.intent && state.question < activeQuestions().length) askQuestion();
        return;
      }
    }
    if (faq) {
      message(faq.answer, false);
      if (state.intent && state.question < activeQuestions().length) askQuestion();
      else if (!state.intent && detected) startFlow(detected.id, false, detected.combined, value);
      else if (!state.intent) message(config.fallback, false);
      return;
    }
    if (engine.wantsBooking(value)) { startBooking(value); return; }
    if (engine.asksQuestion(value) && state.intent) {
      if (state.intent === "investing") {
        message("That's a good question for our investing team. You can bring it to an investing exploration call.", false);
        link("Book an investing exploration call", config.bookingLinks.investing);
      } else {
        message(config.unknownQuestion || "That's a great question for our team.", false);
        if (state.question < activeQuestions().length) askQuestion();
      }
      return;
    }
    if (state.intent && state.question >= 0 && state.question < activeQuestions().length) {
      var explicitTopicChange = /^(?:actually\b|also\b|switch\b|change\b|let's (?:talk|switch)\b|can we (?:talk|switch)\b|i (?:also )?(?:want|need|plan|intend|would like) to\b|we (?:also )?(?:want|need|plan) to\b|i(?:'m| am) (?:looking to|planning to|interested in)\b)/i.test(value);
      if (explicitTopicChange && state.intent === "selling" && detected && detected.id === "buying") {
        state.combined = true;
        state.question = 0;
        state.answers = [];
        message("Got it—we'll plan your sale and next purchase together.", false);
        askQuestion();
        return;
      }
      if (explicitTopicChange && detected && detected.id !== state.intent && !(state.intent === "selling" && activeQuestions()[state.question].key === "nextDestination") && !((state.intent === "buying" && detected.id === "relocating") || (state.intent === "relocating" && detected.id === "buying"))) {
        startFlow(detected.id, false, detected.combined, value);
        return;
      }
      acceptAnswer(value.slice(0, 160));
      return;
    }
    if (detected) startFlow(detected.id, false, detected.combined, value);
    else if (engine.wantsBooking(value)) startBooking(value);
    else message(config.fallback, false);
  }
  function clearConversation() {
    stopVoiceTyping();
    messageGeneration += 1;
    log.querySelectorAll(".rchat-row--typing").forEach(function (row) { row.remove(); });
    try { window.localStorage.removeItem(storageKey); } catch (_) { /* Storage may be unavailable. */ }
    state.intent = null;
    state.combined = false;
    state.question = -1;
    state.answers = [];
    state.profile = {};
    state.memories = {};
    state.memoryProfiles = {};
    state.history = [];
    state.contact = null;
    state.booking = null;
    state.offTrackOffer = false;
    state.ended = false;
    state.previousInput = "";
    attachment = null;
    attachmentInput.value = "";
    showAttachment();
    state.started = true;
    state.sentMessageSinceOpen = false;
    input.value = "";
    input.disabled = false;
    input.maxLength = 2000;
    sizeInput();
    sendButton.disabled = true;
    newMessageButton.hidden = true;
    log.replaceChildren();
  }
  function scrollToLatest() {
    var previous = log.style.scrollBehavior;
    log.style.scrollBehavior = "auto";
    log.scrollTop = log.scrollHeight;
    newMessageButton.hidden = true;
    window.requestAnimationFrame(function () { log.style.scrollBehavior = previous; });
  }
  function open() {
    unlockAudio();
    state.lastFocus = document.activeElement;
    state.sentMessageSinceOpen = false;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close Raleigh help chat");
    window.dispatchEvent(new CustomEvent("raleigh-chat-state", { detail: { blocked: true, reason: "custom_chat_open" } }));
    if (!state.started) {
      state.started = true;
      message(config.welcome, false);
    }
    scrollToLatest();
    input.focus();
  }
  function close() {
    stopVoiceTyping();
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open Raleigh help chat");
    window.dispatchEvent(new CustomEvent("raleigh-chat-state", { detail: { blocked: false, reason: "custom_chat_closed", sentMessage: state.sentMessageSinceOpen } }));
    (state.lastFocus && state.lastFocus.focus ? state.lastFocus : launcher).focus();
  }
  launcher.addEventListener("click", function () { panel.hidden ? open() : close(); });
  input.addEventListener("input", function () {
    sizeInput(true);
    sendButton.disabled = state.submitting || pendingBotMessages > 0 || !input.value.trim();
  });
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!sendButton.disabled) compose.requestSubmit();
    }
  });
  microphoneButton.addEventListener("click", function () {
    if (!SpeechRecognition) {
      message("Voice typing isn't available in this browser. Please type your message instead.", false);
      return;
    }
    if (speech) { stopVoiceTyping(); return; }
    speech = new SpeechRecognition();
    speech.lang = "en-US";
    speech.continuous = true;
    speech.interimResults = true;
    speech.maxAlternatives = 1;
    var dictatedBeforeStart = input.value.trim();
    var restartAttempts = 0;
    var recognitionErrored = false;
    speech.onresult = function (event) {
      restartAttempts = 0;
      var spoken = [];
      for (var i = 0; event.results && i < event.results.length; i++) {
        var phrase = event.results[i][0] && event.results[i][0].transcript;
        if (phrase) spoken.push(phrase.trim());
      }
      input.value = [dictatedBeforeStart].concat(spoken).filter(Boolean).join(" ").slice(0, input.maxLength);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.scrollTop = input.scrollHeight;
    };
    speech.onerror = function (event) {
      recognitionErrored = true;
      if (event.error !== "aborted") message("I couldn't hear that clearly. Please try the microphone again or type your message.", false);
    };
    speech.onend = function () {
      if (speech && !recognitionErrored && !panel.hidden && !input.disabled && restartAttempts < 2) {
        restartAttempts += 1;
        try { speech.start(); return; } catch (_) { /* The browser may require another click. */ }
      }
      speech = null;
      microphoneButton.classList.remove("rchat-mic--active");
      microphoneButton.setAttribute("aria-label", "Speak a message");
    };
    try {
      speech.start();
      microphoneButton.classList.add("rchat-mic--active");
      microphoneButton.setAttribute("aria-label", "Stop voice typing");
    } catch (_) { speech = null; microphoneButton.classList.remove("rchat-mic--active"); }
  });
  attachmentButton.addEventListener("click", function () {
    if (!config.chatAttachmentsEnabled) {
      message("Photo and PDF attachments are being connected. Please type your question for now.", false);
      return;
    }
    attachmentInput.click();
  });
  attachmentInput.addEventListener("change", function () {
    var file = attachmentInput.files && attachmentInput.files[0];
    if (!file) return;
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type) || file.size > 4 * 1024 * 1024) {
      attachmentInput.value = "";
      message("Please choose a JPG, PNG, WebP, or PDF under 4 MB.", false);
      return;
    }
    if (state.booking || state.intent === "investing" || /^\/invest(?:\/|$)/i.test(window.location.pathname)) {
      attachmentInput.value = "";
      message("I can take a file with a Living in Raleigh contact request. For an investing question, please use the calculator message form.", false);
      return;
    }
    attachment = file;
    showAttachment();
    message("I've attached " + file.name + ". I'll send it with your contact request after I get your name, email, phone, and question.", false, { remember: false });
    if (!state.contact) showContact();
  });
  attachmentRemove.addEventListener("click", function () { attachment = null; attachmentInput.value = ""; showAttachment(); });
  newMessageButton.addEventListener("click", function () { log.scrollTop = log.scrollHeight; newMessageButton.hidden = true; });
  testResetButton.addEventListener("click", function () {
    if (state.submitting) return;
    clearConversation();
    try { window.localStorage.removeItem(safetyKey); } catch (_) {}
    root.hidden = false;
    message(config.welcome, false);
    input.focus();
  });
  log.addEventListener("scroll", function () {
    if (log.scrollHeight - log.scrollTop - log.clientHeight < 48) newMessageButton.hidden = true;
  });
  closeButton.addEventListener("click", close);
  compose.addEventListener("submit", function (event) {
    event.preventDefault();
    stopVoiceTyping();
    var value = input.value;
    input.value = "";
    sizeInput();
    sendButton.disabled = true;
    handleText(value);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) close();
  });
  restore();
  sizeInput();
})();
