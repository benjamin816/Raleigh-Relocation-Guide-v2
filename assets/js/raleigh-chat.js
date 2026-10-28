(function () {
  "use strict";
  var config = window.RaleighChatConfig;
  var engine = window.RaleighChatEngine;
  if (!config || !engine || document.querySelector(".rchat")) return;
  var path = window.location.pathname.replace(/index\.html$/, "");
  if (config.excludedPaths.indexOf(path) !== -1) return;
  var isTestSurface = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ||
    (window.__raleighPreviewMode === true && /^\/raleigh-chat-preview-[a-f0-9]{32}\/$/.test(path));

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
        '<button class="rchat-tool rchat-attach" type="button" aria-label="Attach a photo or PDF" title="Attach a photo or PDF" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 11.5-8.6 8.6a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button>' +
        '<input class="rchat-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden />' +
        '<button class="rchat-send" type="submit" aria-label="Send message" disabled>➤</button></form>' +
    '</section>' +
    '<span class="rchat-unread" role="status" hidden><span class="rchat-unread-number">1</span> <span class="rchat-unread-copy">NEW MESSAGE</span></span>' +
    '<button class="rchat-launch" type="button" aria-label="Open Raleigh help chat" aria-expanded="false">' +
      '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 7h20a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H15l-8 5v-5H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z"/><path d="M10 14h12M10 19h8"/></svg>' +
    '</button>';
  document.body.appendChild(root);

  var panel = root.querySelector(".rchat-panel");
  var launcher = root.querySelector(".rchat-launch");
  var unreadBadge = root.querySelector(".rchat-unread");
  var unreadNumber = root.querySelector(".rchat-unread-number");
  var unreadCopy = root.querySelector(".rchat-unread-copy");
  var closeButton = root.querySelector(".rchat-close");
  var log = root.querySelector(".rchat-log");
  var newMessageButton = root.querySelector(".rchat-new");
  var testResetButton = root.querySelector(".rchat-test-reset");
  if (isTestSurface) testResetButton.hidden = false;
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
  function updateAttachmentAvailability() {
    attachmentButton.hidden = !(config.chatAttachmentsEnabled && state.profile.preApproved && state.profile.usingFinancing &&
      (state.intent === "buying" || state.intent === "relocating" || state.intent === "selling" && state.combined) &&
      !state.completed && !state.ended);
  }
  function offerPreapprovalUpload() {
    updateAttachmentAvailability();
    if (attachmentButton.hidden || state.profile.preapprovalUploadOffered) return;
    state.profile.preapprovalUploadOffered = true;
    persist();
    message("If you'd like the team to review your pre-approval before the call, the paperclip is available now. It's completely optional, and I'll send the file with your details after the call is booked.", false);
  }
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
  var resumeQuestionOnOpen = false;
  var storageDays = Number.isInteger(config.conversationMemoryDays) ? Math.max(1, Math.min(config.conversationMemoryDays, 365)) : 180;
  var state = { intent: null, combined: false, question: -1, answers: [], profile: {}, memories: {}, memoryProfiles: {}, history: [], started: false, hasUserMessage: false, completed: false, unreadCount: 0, badgeReadyAt: 0, lastFocus: null, contact: null, booking: null, questionDetour: false, offTrackOffer: false, submitting: false, ended: false, sentMessageSinceOpen: false, previousInput: "" };
  var safetyKey = "raleigh-guide-chat-safety-v1";
  var pulseTimer = 0;
  var pulseEndTimer = 0;
  var badgeTimer = 0;
  var attentionStartKey = "rchatAttentionStartedAt";
  var pulseNextKey = "rchatPulseNextAt";
  var openedWithoutReplyKey = "rchatOpenedWithoutReply";
  function attentionSessionNumber(key) {
    try { return Number(window.sessionStorage.getItem(key)) || 0; } catch (_) { return 0; }
  }
  function attentionSessionSet(key, value) {
    try { window.sessionStorage.setItem(key, String(value)); } catch (_) { /* Timing stays page-local. */ }
  }
  function cancelPulse() {
    if (pulseTimer) window.clearTimeout(pulseTimer);
    if (pulseEndTimer) window.clearTimeout(pulseEndTimer);
    pulseTimer = pulseEndTimer = 0;
    launcher.classList.remove("rchat-launch--pulse");
  }
  function schedulePulse() {
    if (pulseTimer) window.clearTimeout(pulseTimer);
    pulseTimer = 0;
    if (state.completed || state.hasUserMessage || !panel.hidden) return;
    var openedWithoutReply = attentionSessionNumber(openedWithoutReplyKey) === 1;
    var interval = openedWithoutReply ? 30000 : 60000;
    var start = attentionSessionNumber(attentionStartKey);
    if (!start || start > Date.now()) { start = Date.now(); attentionSessionSet(attentionStartKey, start); }
    var next = attentionSessionNumber(pulseNextKey);
    if (!next || next < start) { next = start + 30000; attentionSessionSet(pulseNextKey, next); }
    pulseTimer = window.setTimeout(function () {
      pulseTimer = 0;
      if (state.completed || state.hasUserMessage || !panel.hidden) return;
      if (document.visibilityState === "visible") {
        launcher.classList.add("rchat-launch--pulse");
        pulseEndTimer = window.setTimeout(function () { launcher.classList.remove("rchat-launch--pulse"); pulseEndTimer = 0; }, 5000);
      }
      attentionSessionSet(pulseNextKey, Date.now() + interval);
      schedulePulse();
    }, Math.max(0, next - Date.now()));
  }
  function refreshAttention() {
    try { if (window.localStorage.getItem("livrBookingReportedAt")) state.completed = true; } catch (_) {}
    if (badgeTimer) { window.clearTimeout(badgeTimer); badgeTimer = 0; }
    if (state.completed || !panel.hidden) { cancelPulse(); unreadBadge.hidden = true; return; }
    if (state.hasUserMessage) {
      cancelPulse();
      if (!state.unreadCount) { unreadBadge.hidden = true; return; }
      var delay = Math.max(0, state.badgeReadyAt - Date.now());
      if (delay) {
        unreadBadge.hidden = true;
        badgeTimer = window.setTimeout(refreshAttention, delay);
        return;
      }
      var count = state.unreadCount;
      unreadNumber.textContent = count > 99 ? "99+" : String(count);
      unreadCopy.textContent = count === 1 ? "NEW MESSAGE" : "NEW MESSAGES";
      unreadBadge.hidden = false;
      return;
    }
    unreadBadge.hidden = true;
    schedulePulse();
  }
  function finishConversation() {
    state.completed = true;
    updateAttachmentAvailability();
    persist();
    refreshAttention();
  }
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
    if (priorSafety && priorSafety.strikes >= 2 && !isTestSurface) { root.hidden = true; return; }
  } catch (_) { /* Private browsing may disable local storage. */ }
  function redact(text) {
    return String(text).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
      .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone removed]").slice(0, 2000);
  }
  function persist() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 2, updatedAt: Date.now(), started: state.started, hasUserMessage: state.hasUserMessage, completed: state.completed,
        unreadCount: state.unreadCount, badgeReadyAt: state.badgeReadyAt,
        intent: state.intent, combined: state.combined, question: state.question, questionDetour: state.questionDetour,
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
  function submitBookingAttachment(file, booking, result) {
    if (!file || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.leadEndpoint || "")) return;
    var parts = booking.details.name.trim().split(/\s+/);
    readAttachment(file).then(function (encoded) {
      return window.fetch(config.leadEndpoint, {
        method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          lead_type: "requested_contact", source_key: "website_rule_chat",
          source_page: window.location.pathname,
          requested_contact_source: "Chat pre-approval for booked exploration call",
          requested_contact_intent: state.intent || "buying",
          requested_contact_notes: "Optional pre-approval for " + bookingLabel(result.start) + " with " + (result.assignedHost || "the team") + ". Booking request: " + booking.requestId,
          first_name: parts.shift() || "", last_name: parts.join(" "),
          email: booking.details.email, phone: booking.details.phone,
          consent_to_contact: true, submission_id: booking.requestId + "-preapproval",
          chat_attachment: encoded
        })
      });
    }).then(function () {
      message("Your optional pre-approval was submitted for processing with your booking details.", false, { remember: false });
    }).catch(function () {
      message("Your call is booked, but I couldn't send the pre-approval file. Please email it to livinginraleighteam@gmail.com if you'd like the team to review it before your call.", false, { remember: false });
    });
  }
  function restore() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (!saved || (saved.version !== 1 && saved.version !== 2) || !Number.isFinite(saved.updatedAt) ||
          Date.now() - saved.updatedAt > storageDays * 86400000 || saved.updatedAt > Date.now() + 86400000) return;
      state.started = saved.started === true;
      state.hasUserMessage = saved.hasUserMessage === true;
      state.completed = saved.completed === true;
      state.unreadCount = Number.isInteger(saved.unreadCount) ? Math.max(0, Math.min(saved.unreadCount, 100)) : 0;
      state.badgeReadyAt = Number.isFinite(saved.badgeReadyAt) ? Math.max(0, Math.min(saved.badgeReadyAt, Date.now() + 3000)) : 0;
      state.intent = saved.version === 2 && Object.prototype.hasOwnProperty.call(config.flows, saved.intent) ? saved.intent : null;
      state.combined = state.intent === "selling" && saved.combined === true;
      state.profile = saved.version === 2 && saved.profile && typeof saved.profile === "object" ? saved.profile : {};
      state.question = Number.isInteger(saved.question) ? Math.max(-1, Math.min(saved.question, state.intent ? activeQuestions().length : -1)) : -1;
      state.questionDetour = saved.questionDetour === true;
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
      if (!state.hasUserMessage && state.history.some(function (item) { return item.byUser; })) state.hasUserMessage = true;
      updateAttachmentAvailability();
      resumeQuestionOnOpen = !!(state.history.length && state.history[state.history.length - 1].byUser &&
        (state.profile.awaitingVisitReason || (state.intent && state.question >= 0 && state.question < activeQuestions().length)));
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
  var clarificationTimer = null;
  var lastInputAt = 0;
  var lastUserSentAt = 0;
  var lastBotDeliveredAt = 0;
  function cancelClarification() {
    if (clarificationTimer) window.clearTimeout(clarificationTimer);
    clarificationTimer = null;
  }
  function scheduleClarification(text) {
    cancelClarification();
    var started = Date.now();
    function check() {
      if (panel.hidden) { clarificationTimer = null; return; }
      if (Date.now() - started < 60000 &&
          (input.value.trim() || Date.now() - lastInputAt < 2000)) {
        clarificationTimer = window.setTimeout(check, 1000);
        return;
      }
      clarificationTimer = null;
      message(text, false);
    }
    clarificationTimer = window.setTimeout(check, 15000);
  }
  function interruptBotQueue() {
    messageGeneration += 1;
    botQueue = Promise.resolve();
    pendingBotMessages = 0;
    log.querySelectorAll(".rchat-row--typing").forEach(function (row) { row.remove(); });
  }
  function waitForVisitorPause(generation, minimumMs) {
    var started = Date.now();
    return new Promise(function (resolve) {
      function check() {
        if (generation !== messageGeneration || Date.now() - started >= 60000 ||
            (Date.now() - started >= minimumMs && !input.value.trim() && Date.now() - lastInputAt >= minimumMs)) {
          resolve();
        } else window.setTimeout(check, 250);
      }
      check();
    });
  }
  function replyDelayMs() {
    var roll = Math.random();
    return Math.round(roll < .68 ? 2000 + roll / .68 * 3000 :
      roll < .93 ? 5000 + (roll - .68) / .25 * 2500 :
      7500 + (roll - .93) / .07 * 2500);
  }
  function waitMs(milliseconds) {
    return new Promise(function (resolve) { window.setTimeout(resolve, milliseconds); });
  }
  function waitBeforeTyping(generation, replyDelay, betweenMessagesDelay) {
    return new Promise(function (resolve) {
      function check() {
        if (generation !== messageGeneration ||
            (Date.now() - lastUserSentAt >= replyDelay && Date.now() - lastBotDeliveredAt >= betweenMessagesDelay)) resolve();
        else window.setTimeout(check, 100);
      }
      check();
    });
  }
  function queueBotMessage(text, options) {
    var generation = messageGeneration;
    var replyDelay = replyDelayMs();
    var betweenMessagesDelay = 900 + Math.round(Math.random() * 1100);
    var typingDuration = 1300 + Math.round(Math.random() * 1400);
    var falseStart = Math.random() < .06;
    pendingBotMessages += 1;
    botQueue = botQueue.then(async function () {
      await waitBeforeTyping(generation, replyDelay, betweenMessagesDelay);
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
      if (!panel.hidden && !input.value.trim()) scrollToLatest();
      if (falseStart) {
        await waitMs(700 + Math.round(Math.random() * 500));
        row.remove();
        if (generation !== messageGeneration) return;
        await waitMs(650 + Math.round(Math.random() * 550));
        if (generation !== messageGeneration) return;
        log.appendChild(row);
      }
      await waitForVisitorPause(generation, typingDuration);
      row.remove();
      if (generation === messageGeneration) renderMessage(text, false, options);
    }).finally(function () {
      if (generation !== messageGeneration) return;
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
    if (!byUser && !options.restoring) { lastBotDeliveredAt = Date.now(); incomingSound(); }
    if (!options.restoring && !panel.hidden && !input.value.trim()) scrollToLatest();
    if (!options.restoring && options.remember !== false && !state.contact && !state.booking) {
      state.history.push({ text: redact(text), byUser: !!byUser, at: now.toISOString(), link: options.link || null });
      state.history = state.history.slice(-80);
      persist();
    }
    if (!byUser && !options.restoring && panel.hidden && state.hasUserMessage && !state.completed) {
      state.unreadCount = Math.min(100, state.unreadCount + 1);
      persist();
      refreshAttention();
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
    var available = state.booking.allSlots.slice(state.booking.offset);
    var first = available[0];
    var firstDay = first && new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(first.start));
    function isDifferentDay(slot) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(slot.start)) !== firstDay;
    }
    var differentDay = available.slice(1).find(function (slot) { return isDifferentDay(slot) && slot.daypart !== first.daypart; }) ||
      available.slice(1).find(isDifferentDay);
    var second = differentDay || available[1];
    state.booking.slots = first ? [first].concat(second ? [second] : []) : [];
    state.booking.step = "choose";
    if (!state.booking.slots.length) {
      message("I don't see an open call time right now. You can leave a message for the team or call 919-737-7896.", false);
      state.booking = null;
      return;
    }
    message("We have " + state.booking.slots.map(function (slot, index) {
      return (index === 0 ? "" : " or ") + bookingLabel(slot.start);
    }).join("") + ". " + (config.bookingChoicePrompt || "Which time works for you? Let me know if you'd prefer a video or phone call."), false);
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
    if (!requestedPreference.host && state.profile.requestedHost) requestedPreference.host = state.profile.requestedHost;
    if (!config.chatRoundRobinBookingEnabled && requestedPreference.host) {
      message("I can't guarantee a call with a specific team member from chat yet. Please call 919-737-7896 and we'll find a time with " + requestedPreference.host + ".", false);
      return;
    }
    state.booking = { step: "loading", slots: [], allSlots: [], offset: 0, details: {},
      preference: requestedPreference };
    if (/\b(phone|telephone)\b/i.test(request || "")) state.booking.details.callType = "phone";
    else if (config.chatVideoBookingEnabled && /\b(video|zoom|google meet|virtual)\b/i.test(request || "")) state.booking.details.callType = "video";
    loadBookingSlots(state.booking);
  }
  function loadBookingSlots(booking) {
    var followUp = booking.step === "choose";
    var searchId = booking.slotSearchId = (booking.slotSearchId || 0) + 1;
    booking.step = "loading";
    if (followUp) message("Let me check.", false);
    bookingCall("slots", config.chatRoundRobinBookingEnabled ? [booking.preference] : []).then(function (slots) {
      if (state.booking === booking && booking.slotSearchId === searchId) offerBookingSlots(slots);
    }).catch(function (error) {
      if (state.booking === booking && booking.slotSearchId === searchId) bookingFailed(error);
    });
  }
  function handleBookingAnswer(value) {
    var booking = state.booking;
    if (/\b(video|zoom|meet|virtual)\b/i.test(value)) booking.details.callType = "video";
    else if (/\b(phone|telephone|call me)\b/i.test(value)) booking.details.callType = "phone";
    if (/^(cancel|stop|never mind)$/i.test(value)) {
      state.booking = null;
      message("No call was booked. What else can I help with?", false);
      return;
    }
    if (booking.step === "format") {
      if (!booking.details.callType && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200) {
        booking.details.callType = "video";
        booking.details.email = value;
        booking.step = "phone";
        message(config.bookingPhonePrompt || "What phone number should we use for the call?", false);
        return;
      }
      if (!booking.details.callType) { message("You can send your email for a video call, or say phone if you'd prefer a phone call.", false); return; }
      if (booking.details.callType === "video" && !config.chatVideoBookingEnabled) {
        message("I can book a phone call now, or pass your video request to the team.", false);
        return;
      }
      booking.step = "email";
      message(config.bookingEmailPrompt || "What's your email address for the invitation?", false);
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
      var choiceText = value.replace(/\b(?:for|as|on|by)?\s*(?:a\s+)?(?:video|zoom|google meet|virtual|phone|telephone)\s*call\b|\b(?:video|zoom|google meet|virtual|phone|telephone)\b|\s+(?:with|for)\s+(?:benjamin|ben|ricardo)\b/gi, "").trim();
      var isExplicitTime = /\b\d{1,2}(?::\d\d)?\s*(?:am|pm)\b|\b20\d{2}-\d\d-\d\d\b/i.test(choiceText);
      var choiceIndex = !isExplicitTime && /\b(?:1|one|first)\b/i.test(choiceText) ? 0 : !isExplicitTime && /\b(?:2|two|second)\b/i.test(choiceText) ? 1 : -1;
      var choice = choiceIndex >= 0 ? booking.slots[choiceIndex] : null;
      if (choice) {
        if (config.chatRoundRobinBookingEnabled && booking.preference.host &&
            Array.isArray(choice.availableHosts) && choice.availableHosts.indexOf(booking.preference.host) === -1) {
          message("I'll find a time when " + booking.preference.host + " is available.", false);
          loadBookingSlots(booking);
          return;
        }
        booking.start = choice.start;
        booking.step = booking.details.callType ? "email" : "format";
        message("Great, " + bookingLabel(booking.start) + ". " + (booking.step === "email" ? (config.bookingEmailPrompt || "What's your email address for the invitation?") : "We prefer a video call so we can meet face to face, open the map, and share the resources you need. If you'd rather have a phone call, just say phone. Otherwise, what's the best email for your invitation?"), false);
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
        booking.step = booking.details.callType ? "email" : "format";
        message("That works: " + bookingLabel(booking.start) + ". " + (booking.step === "email" ? (config.bookingEmailPrompt || "What's your email address for the invitation?") : "We prefer a video call so we can meet face to face, open the map, and share the resources you need. If you'd rather have a phone call, just say phone. Otherwise, what's the best email for your invitation?"), false);
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
        var bookingFile = attachment;
        attachment = null;
        attachmentInput.value = "";
        showAttachment();
        state.booking = null;
        try { window.localStorage.setItem("livrBookingReportedAt", new Date().toISOString()); } catch (_) {}
        finishConversation();
        window.dispatchEvent(new CustomEvent("raleigh-booking-confirmed", { detail: { source: "website_chat" } }));
        message("Great, " + booking.details.name.split(/\s+/)[0] + ", I've got you confirmed for " + bookingLabel(result.start) + " with " + (result.assignedHost || "the team") + ". You'll get a calendar invitation." + (booking.details.callType === "video" ? (result.videoUrl ? " The Google Meet link is in the invitation." : " The team will add the video link before your call.") : "") + (result.preCallEmailSent ? " Look out for an email titled What To Know Before Our Call, with a quick form and resources to help you prepare." : "") + " If you need anything in the meantime, message me here or call or text the team at 919-737-7896.", false);
        if (bookingFile) submitBookingAttachment(bookingFile, booking, result);
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
    if (sourceText) { captureVisitorContext(sourceText); markPreapproval(sourceText); }
    updateAttachmentAvailability();
    var knownLocation = /^(buying|relocating|investing)$/.test(id) && sourceText && engine.detectLocation(sourceText, config);
    if (knownLocation) knownLocation = engine.resolveOrigin(knownLocation, config);
    if (knownLocation) {
      state.profile.location = knownLocation.type;
      state.profile.origin = knownLocation.place || "";
      state.profile.originCode = knownLocation.stateCode || "";
      state.profile.originCity = knownLocation.city || "";
      state.answers.push(redact(sourceText));
      state.question = 1;
      state.memories[id] = state.answers.slice();
      state.memoryProfiles[id] = Object.assign({}, state.profile);
    }
    persist();
    if (id === "relocating" && !knownLocation) {
      var opening = (flow.intro || "Awesome").replace(/[.,!?\s]+$/, "");
      var originQuestion = activeQuestions()[0].text;
      message(opening + ", " + originQuestion.charAt(0).toLowerCase() + originQuestion.slice(1), false);
      return;
    }
    if (!knownLocation) message(state.combined && flow.combinedIntro ? flow.combinedIntro : flow.intro, false);
    offerPreapprovalUpload();
    askQuestion(knownLocation ? locationAcknowledgement(knownLocation) : "");
  }
  function locationAcknowledgement(location) {
    if (state.intent === "investing") return location.type === "local" ? "Great!" : "Awesome.";
    if (location.type === "local") return "Great.";
    if (location.city && location.stateCode === "TX") return (config.relocationResponses || {}).cityTexas || "Oh, Texas? That's awesome.";
    if (location.city && location.stateCode) return "Oh, " + config.originStates[location.stateCode] + "? That's awesome.";
    var place = (location.place || "").toLowerCase();
    return (config.originAcknowledgements || {})[place] || "Great.";
  }
  function originLabel() {
    if (state.profile.originCode && (config.originStates || {})[state.profile.originCode]) return config.originStates[state.profile.originCode];
    return (state.profile.origin || "").replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });
  }
  function askQuestion(prefix) {
    var flow = config.flows[state.intent];
    var questions = activeQuestions();
    if (state.question >= questions.length) {
      var sellerSummer = state.intent === "selling" && /\bnext summer\b/i.test(state.profile.targetTiming || "");
      var buyerSummer = /^(buying|relocating)$/.test(state.intent) && /\bsummer\b/i.test(state.profile.targetTiming || "");
      message(state.profile.shortTiming ? "Well, great. Based on that timing, we should absolutely set up an exploration call with the team to help build you a game plan around your move." : sellerSummer ? (flow.finishNextSummer || flow.finish) : buyerSummer ? "That's a great time to make the move. That's typically when we see the most options on the buy side here in our market, and it's often one of the best times to sell. A one-on-one conversation with the team would be a great next step to build a game plan around your move." : (prefix ? prefix + " " : "") + flow.finish, false);
      if (flow.booking === "general") startBooking();
      else link("Book an investing exploration call", config.bookingLinks.investing);
      return;
    }
    var question = questions[state.question];
    var variants = [question.text].concat(Array.isArray(question.alternatives) ? question.alternatives.filter(Boolean) : []);
    var wording = variants[state.answers.length % variants.length] || question.text;
    if (state.intent === "relocating" && state.profile.location === "out") {
      if (question.key === "whyRaleigh") wording = state.profile.originCity ? "What has you making the move?" : "What has you looking at moving to Raleigh" + (state.profile.origin ? " from " + originLabel() : "") + "?";
      if (question.key === "originHousing") wording = "Do you have a home" + (state.profile.origin ? " in " + originLabel() : " there") + " that you'd need to sell, or are you currently renting?";
      if (question.key === "areas") wording = "What areas around Raleigh are you interested in buying a home in?";
      if (question.key === "familyNearby") wording = state.profile.nearbyPerson === "friends" ? "What part of Raleigh are your friends in?" : "What part of Raleigh is your family in?";
    }
    if (question.key === "priorityMore" && (state.profile.remoteWork || state.profile.retired || state.profile.noChildren)) {
      var examples = ["nearby amenities", "shopping"];
      if (!state.profile.retired && !state.profile.noChildren) examples.push("schools");
      if (!state.profile.remoteWork && !state.profile.retired) examples.push("your commute");
      wording = "Is there anything else that's super important to you about the area, like " +
        (examples.length === 2 ? examples.join(" or ") : examples.slice(0, -1).join(", ") + ", or " + examples[examples.length - 1]) + "?";
    }
    if (question.key === "home" && state.profile.homeDetailsGiven) wording = "You mentioned some things you're looking for in a home earlier. Is there anything else that's important to you about the home itself?";
    if ((question.key === "budget" || question.key === "priorityBudget") && state.profile.preApproved) wording = "I know you said you're pre-approved. What price would feel comfortable to you, regardless of the pre-approval amount?";
    if ((question.key === "priorityFinancing" || question.key === "financing") && state.profile.originSale) wording = "Do you think you'll buy with cash from the sale of your current home, or use financing?";
    else if (question.key === "priorityFinancing" || question.key === "financing") wording = "Do you plan on using financing, or will you be buying in cash?";
    if (question.key === "areasReason" && state.profile.familyArea && state.profile.areasMentionFamilyArea) wording += " I know you mentioned having family in " + state.profile.familyArea + ".";
    if (question.key === "areas" && state.profile.priorityAnswered) wording = "Are there any specific areas around Raleigh that you're interested in buying a home in?";
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
      case "whyRaleigh": {
        if (state.intent === "relocating") {
          var responses = config.relocationResponses || {};
          if (state.profile.newJob) return responses.job || "Congrats! That's super exciting.";
          if (state.profile.familyNearby) return responses.family || "Oh, awesome.";
          if (/\b(price|prices|cost of living|affordab\w*|cheaper|less expensive|more for (?:my|the|our) money)\b/.test(text)) {
            return state.profile.originCode === "CA" ? (responses.californiaPrice || responses.price || "Fair enough!") : (responses.price || "Fair enough!");
          }
          if (/\b(weather|warm|warmer|climate|seasons?|cold|winter)\b/.test(text)) return responses.weather || "Totally get that.";
        }
        return /\b(warm|weather|commute)\b/.test(text) ? "That makes sense!" : "I totally understand.";
      }
      case "jobLocation": return "Okay, awesome.";
      case "jobStart": return "Great.";
      case "familyNearby": return /\b(yes|yeah|they do|here|raleigh|cary)\b/.test(text) ? "That's wonderful!" : "Got it.";
      case "currentHome": return /north raleigh/.test(text) ? "North Raleigh is a great area!" : "Okay, great.";
      case "ownedYears": { var years = parseInt(text, 10); return years >= 5 || /\b(five|six|seven|eight|nine|ten|eleven|twelve)\b/.test(text) ? "Wow, you've been there a while!" : "Okay, got it."; }
      case "whySell": case "whySellSolo": return /\b(family|relatives)\b/.test(text) ? "I totally understand." : "That makes sense.";
      case "nextDestination": return "That's exciting!";
      case "nextAreaReason": return "I can see why that appeals to you.";
      case "experience": return /\b(first|new|never)\b/.test(text) ? "That's super exciting!" : "Great, good to know.";
      case "strategy": return "Okay, got it.";
      case "sellingExperience": return /\b(first|never)\b/.test(text) ? "Okay, wonderful." : "Great, good to know.";
      case "timing": return state.profile.shortTiming === "newYear" ? "Looking to avoid the holiday craziness—smart!" : state.profile.shortTiming ? "Gotcha! That move is coming up super quick." : /\bsummer\b/.test(text) && /^(buying|relocating)$/.test(state.intent) ? "" : /\b(spring|summer|fall|winter|next year)\b/.test(text) ? "Totally get it." : "Great, that timing makes sense.";
      case "priorities": return state.profile.commuteMentioned ? "Got it." : state.profile.priorityPrice ? "Awesome." : state.profile.prioritySingle ? "Got it." : "Makes perfect sense.";
      case "priorityMore": return state.profile.commuteMentioned ? "Got it." : state.profile.priorityPrice ? "Awesome." : "Makes perfect sense.";
      case "commuteDestination": return "Got it.";
      case "commuteRange": return "That makes sense.";
      case "priorityBudget": return state.profile.priorityBudgetAmount >= 500000 ? "Okay, great. Sounds like we've got a lot to work with for our market." : "👍";
      case "priorityFinancing": return "Great!";
      case "areas": return state.profile.areasMentionFamilyArea ? "That makes sense." : state.profile.areasNeedFollowup ?
        (state.profile.areasPlural ? "Awesome, those are great areas!" : "Awesome, that's a great area!") : "That makes sense!";
      case "areasReason": return "Makes perfect sense!";
      case "home": return state.profile.budgetKnown ? "That gives me a good picture!" : "Got it.";
      case "homeMore": return "Got it.";
      case "nextHome": return "That gives me a better picture.";
      case "budget": return state.profile.budgetKnown ? (priceAmount(answer) >= 500000 ? "Okay, great. Sounds like we've got a lot to work with for our market." : "👍") : "That's totally fine. We can connect you with a lender to get a clearer picture of your buying power.";
      case "financing": return "Great!";
      case "preapproval": return state.profile.preApproved ? "Great, thanks for letting me know." : "Got it. We can connect you with a trusted local lender.";
      default: return "Got it.";
    }
  }
  function explainRentalOnly() {
    state.intent = null;
    state.question = -1;
    state.profile.pendingRentalPlan = false;
    finishConversation();
    message("A lot of people rent first to get to know the area. We don't have a rental search service, since most local rentals aren't listed through the MLS. Our free Raleigh guides and YouTube videos can help you get started. When you're ready to buy, come back and we'll help you make a game plan for a more permanent home.", false);
    link("Explore Raleigh guides", "/learning-center/");
  }
  function asksToRent(value) {
    return /\b(?:looking|want|need|plan|planning|going|hoping|thinking|interested)\s+to\s+rent\b|\brent(?:ing)?\s+(?:first|for now|instead|now)\b|\b(?:looking|searching)\s+for\s+(?:a\s+)?rental\b/i.test(value);
  }
  function mentionsPrice(value) {
    return /\b(?:price|prices|pricing|budget|affordab\w*|cheap\w*|cost of living|costs? less|lower cost|lower price|more for (?:my|our|the) money)\b|(?:\$\s?\d[\d,]*|\b\d{3,4}\s?k\b)/i.test(value);
  }
  function priceAmount(value) {
    var match = String(value || "").replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*(million|m|thousand|k)?\b/i);
    if (!match) return 0;
    var amount = Number(match[1]);
    var unit = (match[2] || "").toLowerCase();
    if (unit === "million" || unit === "m") amount *= 1000000;
    else if (unit === "thousand" || unit === "k") amount *= 1000;
    return amount >= 10000 ? amount : 0;
  }
  function homeDetailCount(value) {
    var text = String(value || "").toLowerCase();
    return [/\b(?:bed|bedroom)/, /\b(?:bath|bathroom)/, /\b(?:sq\.?\s?ft|square feet|square footage)/, /\b(?:yard|backyard|lot)/, /\b(?:ranch|one.story|single.story|two.story|layout)/, /\b(?:garage|pool|office|basement)/].filter(function (pattern) { return pattern.test(text); }).length;
  }
  function captureVisitorContext(value) {
    var text = String(value || "");
    if (/\b(?:work(?:ing)? remotely|remote (?:job|work|position)|work(?:ing)? from home|fully remote|wfh)\b/i.test(text)) state.profile.remoteWork = true;
    if (/\b(?:retired|retiring|in retirement)\b/i.test(text)) state.profile.retired = true;
    if (/\b(?:no kids|no children|don't have (?:any )?(?:kids|children)|just me|single person|single guy|single woman)\b/i.test(text)) state.profile.noChildren = true;
    else if (/\b(?:have kids|have children|our kids|our children)\b/i.test(text)) state.profile.noChildren = false;
  }
  function markPreapproval(value) {
    var text = String(value || "");
    if (/\b(?:pre[- ]?approv(?:ed|al)|approval letter|approved (?:by|with) (?:a |my )?lender)\b/i.test(text) &&
        !/\b(?:not|never|haven't|have not|need to|looking to|want to|trying to)\s+(?:been\s+|get\s+|be\s+)?pre[- ]?approv/i.test(text)) {
      state.profile.preApproved = true;
      state.profile.usingFinancing = true;
      state.profile.financingKnown = true;
    }
  }
  function acceptAnswer(answer) {
    var question = activeQuestions()[state.question];
    var flowQuestions = config.flows[state.intent].questions;
    var questionPosition = flowQuestions.indexOf(question);
    markPreapproval(answer);
    var acknowledgement = answerAcknowledgement(question, answer);
    if (question && (question.key === "budget" || question.key === "priorityBudget") &&
        /\bpre[- ]?approv(?:ed|al)\b/i.test(answer) && !state.profile.awaitingComfortPrice) {
      state.profile.awaitingComfortPrice = true;
      persist();
      offerPreapprovalUpload();
      message("Thanks for sharing that. What price would feel comfortable to you, regardless of the pre-approval amount?", false);
      return;
    }
    if (question && (question.key === "budget" || question.key === "priorityBudget")) state.profile.awaitingComfortPrice = false;
    if (question && /^(buying|relocating)$/.test(state.intent) &&
        !/^(location|tenure|originHousing|areas|rentalPlan)$/.test(question.key) && asksToRent(answer)) {
      state.profile.pendingRentalPlan = true;
      state.profile.budgetKnown = false;
      message("Are you planning to rent temporarily while you look for a home to buy, or are you only looking to rent?", false);
      return;
    }
    if (question && question.key === "location") {
      var location = engine.detectLocation(answer, config);
      var bareAnswer = answer.trim().replace(/[.!?]+$/, "").trim();
      if (!location && /^[A-Za-z][A-Za-z ,.'-]{1,45}$/.test(bareAnswer) && !/^(?:not sure|i don't know|maybe|yes|no)$/i.test(bareAnswer)) location = { type: "out", place: bareAnswer.toLowerCase() };
      if (!location) { scheduleClarification("Are you already local to Raleigh, or would you be moving from out of state?"); return; }
      location = engine.resolveOrigin(location, config);
      state.profile.location = location.type;
      state.profile.origin = location.place || "";
      state.profile.originCode = location.stateCode || "";
      state.profile.originCity = location.city || "";
      acknowledgement = locationAcknowledgement(location);
    }
    if (question && question.key === "tenure") {
      var tenure = engine.detectTenure(answer);
      if (!tenure) { scheduleClarification("Are you currently renting or do you own your home?"); return; }
      state.profile.tenure = tenure;
      acknowledgement = tenure === "renting" ? "Okay, great." : "Got it.";
    }
    if (question && question.key === "moveGoal") {
      var wantsBuy = /\b(buy|buying|purchase|purchasing|both)\b/i.test(answer);
      var wantsSell = /\b(sell|selling|list|listing|both)\b/i.test(answer);
      if (/\b(rent|renting|lease)\b/i.test(answer) && !wantsBuy && !wantsSell) {
        state.intent = null;
        state.question = -1;
        message("A lot of people rent first to get to know the area. We don't have a rental search service, since most local rentals aren't listed through the MLS. Our free Raleigh guides and YouTube videos can help you get started. When you're ready to buy, come back and we'll help you make a game plan for a more permanent home.", false);
        link("Explore Raleigh guides", "/learning-center/");
        return;
      }
      if (wantsSell) { startFlow("selling", true, wantsBuy); return; }
      if (!wantsBuy) { scheduleClarification("Are you planning to buy a home here, sell a home here, or both?"); return; }
      state.profile.moveGoal = "buying";
      acknowledgement = "Got it.";
    }
    if (question && question.key === "originHousing") {
      state.profile.originSale = /\b(sell|selling|list|listing)\b/i.test(answer);
      state.profile.originRenting = /\b(rent|renting|lease)\b/i.test(answer);
      if (!state.profile.originSale && !state.profile.originRenting) { scheduleClarification("Do you currently own a home you'd need to sell, or are you renting?"); return; }
      acknowledgement = "Got it.";
    }
    if (question && question.key === "rentalPlan") {
      if (/\b(only|just|solely|not (?:looking|planning|ready) to buy|don't (?:want|plan) to buy)\b/i.test(answer) && /\b(rent|renting|lease)\b/i.test(answer)) {
        state.intent = null;
        state.question = -1;
        message("A lot of people rent first to get to know the area. We don't have a rental search service, since most local rentals aren't listed through the MLS. Our free Raleigh guides and YouTube videos can help you get started. When you're ready to buy, come back and we'll help you make a game plan for a more permanent home.", false);
        link("Explore Raleigh guides", "/learning-center/");
        return;
      }
      if (!/\b(buy|buying|purchase|purchasing|permanent home|eventually|later|while|first|temporary|short.term|few months)\b/i.test(answer)) {
        scheduleClarification("Are you planning to buy a home after renting briefly, or are you only looking to rent?");
        return;
      }
      state.profile.rentalClarificationNeeded = false;
      acknowledgement = "That makes sense.";
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
      state.profile.familyNearby = /\b(family|relatives|friends|parents|siblings)\b/i.test(answer);
      state.profile.nearbyPerson = /\bfriends\b/i.test(answer) && !/\b(family|relatives|parents|siblings)\b/i.test(answer) ? "friends" : "family";
      state.profile.newJob = state.intent === "relocating" && /\b(new job|job offer|for (?:a|my) job|for work|work transfer|transferred|new position|starting (?:a|my) job)\b/i.test(answer);
      state.profile.commuteMentioned = /\bcommut(?:e|ing)\b/i.test(answer) && !state.profile.remoteWork && !state.profile.retired;
      state.profile.prioritiesKnown = false;
    }
    if (question && question.key === "jobLocation" && state.profile.commuteMentioned && !state.profile.remoteWork) state.profile.commuteDestinationKnown = true;
    if (question && question.key === "familyNearby") {
      var familyPlace = answer.trim().replace(/[.!?]+$/, "");
      state.profile.familyArea = /^(?:yes|no|yeah|yep|here|not sure)$/i.test(familyPlace) ? "" : familyPlace.slice(0, 60);
    }
    if (question && (question.key === "priorities" || question.key === "priorityMore")) {
      state.profile.priorityAnswered = true;
      state.profile.priorityPrice = mentionsPrice(answer);
      if (/\bcommut(?:e|ing)\b/i.test(answer) && !state.profile.remoteWork && !state.profile.retired) state.profile.commuteMentioned = true;
      state.profile.prioritySingle = question.key === "priorities" && !state.profile.priorityPrice && !state.profile.commuteMentioned && !/,|;|\band\b|\bplus\b|&/i.test(answer);
      if (homeDetailCount(answer)) state.profile.homeDetailsGiven = true;
    }
    if (question && question.key === "commuteDestination") {
      state.profile.commuteDestinationKnown = true;
      state.profile.commuteDestination = answer.slice(0, 120);
    }
    if (question && question.key === "commuteRange") {
      state.profile.commuteRangeKnown = true;
      state.profile.commuteComfort = answer.slice(0, 120);
    }
    if (question && question.key === "priorityBudget") {
      state.profile.priorityBudgetAmount = priceAmount(answer);
      state.profile.budgetAsked = true;
      state.profile.budgetKnown = state.profile.priorityBudgetAmount > 0;
    }
    if (question && (question.key === "priorityFinancing" || question.key === "financing")) {
      state.profile.financingKnown = true;
      state.profile.usingFinancing = (state.profile.preApproved || /\b(?:financ\w*|mortgage|loan|lender)\b/i.test(answer)) && !/\b(?:cash only|all cash|paying cash)\b/i.test(answer);
    }
    if (question && question.key === "preapproval") {
      state.profile.preapprovalAsked = true;
      state.profile.preApproved = /\b(?:yes|already|pre[- ]?approv(?:ed|al))\b/i.test(answer) && !/\b(?:not|no|haven't|have not)\b/i.test(answer);
    }
    offerPreapprovalUpload();
    if (question && question.key === "areas" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.rentalClarificationNeeded = state.intent === "relocating" && /\b(rent|renting|lease)\b/i.test(answer);
      state.profile.areasPlural = /,|\band\b|\bor\b|\//i.test(answer);
      state.profile.areasNeedFollowup = !/\b(?:because|since|near|close to|closer to|for the|for its|for their|due to|like the|love the|drawn to|appeals? to|commute|schools?|walkab|yard|family)\b/i.test(answer);
      state.profile.areasMentionFamilyArea = !!state.profile.familyArea && answer.toLowerCase().indexOf(state.profile.familyArea.toLowerCase()) !== -1;
    }
    if (question && question.key === "home" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.budgetKnown = /\$\s?\d{3,7}|\b\d{3,4}\s?k\b|\b\d{6,7}\b/i.test(answer) && !/\b(?:not sure|don't know|unsure)\b/i.test(answer);
      state.profile.homeSingle = !state.profile.homeDetailsGiven && homeDetailCount(answer) < 2 && !/,|;|\band\b|\bplus\b|&/i.test(answer);
    }
    if (question && question.key === "homeMore") state.profile.homeSingle = false;
    if (question && question.key === "budget" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.budgetAsked = true;
      state.profile.budgetKnown = !/\b(?:not sure|don't know|unsure|no idea|haven't decided|need a lender)\b/i.test(answer);
    }
    if (question && question.key === "timing") {
      state.profile.targetTiming = answer;
      state.profile.shortTiming = state.intent === "investing" ? "" : engine.classifyMoveTiming(answer, new Date());
    }
    if (question && question.key !== "location" && question.key !== "tenure" && question.key !== "originHousing" && question.key !== "rentalPlan") {
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
    persist();
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
      finishConversation();
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
  function isQuestionPreamble(value) {
    return /^(?:i (?:have|had|got) (?:a |one |another |quick )?question|can i ask (?:you )?(?:a |one )?question|can i ask you something|ask a question|quick question|one question|question for you)\s*[.!?]*$/i.test(value);
  }
  function requestedPerson(value) {
    if (/\b(?:benjamin|ben)\b/i.test(value) && !/\bricardo\b/i.test(value)) return "Benjamin";
    if (/\bricardo\b/i.test(value) && !/\b(?:benjamin|ben)\b/i.test(value)) return "Ricardo";
    return "";
  }
  function asksForBenjaminNumber(value) {
    return /\b(?:benjamin|ben)\b.{0,70}\b(?:number|phone|call|text|reach)\b|\b(?:number|phone|call|text|reach)\b.{0,70}\b(?:benjamin|ben)\b/i.test(value);
  }
  function asksForTeamMember(value) {
    return /^(?:human|a human|real person|talk to somebody|speak to somebody)\s*[.!?]*$/i.test(value) ||
      /\b(?:speak|talk|connect|reach)\s+(?:me\s+)?(?:with|to)\s+(?:a |the )?(?:team(?: member)?|person|human|agent|someone|somebody|benjamin|ben|ricardo)\b/i.test(value) ||
      /\b(?:get|put)\s+me\s+(?:in touch|connected)\s+with\s+(?:a |the )?(?:team|person|human|agent|someone|somebody|benjamin|ben|ricardo)\b/i.test(value);
  }
  function asksToMeetNamedHost(value) {
    return !!requestedPerson(value) && /\b(?:book|schedule|appointment|meeting|meet|call|time|slot)\b/i.test(value);
  }
  function resumeAfterQuestion() {
    if (state.booking) {
      var booking = state.booking;
      if (booking.step === "choose" && booking.slots.length) {
        message("Would " + booking.slots.map(function (slot) { return bookingLabel(slot.start); }).join(" or ") + " work for an introduction call, or would another time be better?", false);
      } else if (booking.step === "format") message("Would you prefer a video call, or a phone call? You can also send your email to continue with video.", false);
      else if (booking.step === "email") message(config.bookingEmailPrompt, false);
      else if (booking.step === "phone") message(config.bookingPhonePrompt, false);
      else if (booking.step === "name") message(config.bookingNamePrompt, false);
      else if (booking.step === "notes") message("Anything you'd like us to know before the call? You can type skip.", false);
      else message("I'm still checking the calendar. One moment, please.", false);
    } else if (state.contact) {
      var item = config.contactQuestions[state.contact.step];
      if (item) message(item.prompt, false);
      else message(config.contactConsentPrompt, false);
    } else if (state.intent && state.question >= 0 && state.question < activeQuestions().length) askQuestion();
    else message(config.fallback, false);
  }
  function answerSideQuestion(value, faq) {
    var humanRequest = asksForBenjaminNumber(value) || asksForTeamMember(value);
    var person = humanRequest ? requestedPerson(value) : "";
    if (person) { state.profile.requestedHost = person; persist(); }
    if (person === "Benjamin") message("Benjamin's direct call and text line is " + config.benjaminDirectPhone + ". You can call or text him anytime.", false);
    else if (person === "Ricardo") message("You can reach Ricardo through the Living in Raleigh team line at 919-737-7896. You can call or text us there.", false);
    else if (humanRequest) message("Absolutely. You can call or text the Living in Raleigh team at 919-737-7896.", false);
    else if (faq) message(faq.answer, false);
    else message(config.unknownQuestion || "That's a great question for the team to cover on your call.", false);
    if (humanRequest) {
      if (state.booking && person && state.booking.preference.host !== person) {
        state.booking.preference.host = person;
        message("To make sure " + person + " is prepared, I'll check the next openings with " + person + ".", false);
        state.booking.step = "loading";
        loadBookingSlots(state.booking);
        return;
      }
      if (!state.booking && state.intent && state.question >= 0 && state.question < activeQuestions().length) {
        var remaining = activeQuestions().length - state.question;
        message("To help " + (person || "the team") + " prepare, I have " + (remaining === 1 ? "one more question" : remaining === 2 ? "two more questions" : "a few more questions") + " for you.", false);
        askQuestion();
        return;
      }
      if (!state.booking && (!state.intent || state.question >= activeQuestions().length)) {
        message("To make sure " + (person || "someone on the team") + " is prepared, let's set up an introduction call.", false);
        startBooking(person || "");
        return;
      }
    }
    resumeAfterQuestion();
  }
  function endBrowsingConversation() {
    state.profile.awaitingVisitReason = false;
    state.profile.browsingEnded = true;
    finishConversation();
    message("Got it. A lot of people check out the site when they're still unsure about moving to Raleigh. Please don't hesitate to reach out if you have any questions that aren't answered by all our free resources here and on the Living in Raleigh YouTube channel.", false);
  }
  function handleText(text) {
    var value = text.trim();
    if (!value || state.submitting || state.ended) return;
    state.hasUserMessage = true;
    persist();
    lastUserSentAt = Date.now();
    cancelClarification();
    interruptBotQueue();
    state.sentMessageSinceOpen = true;
    try { window.sessionStorage.setItem("livrChatQuietUntil", String(Date.now() + 30 * 60 * 1000)); } catch (_) {}
    if (/^(forget|forget me|clear chat|delete chat history)$/i.test(value)) {
      clearConversation();
      message("This browser's chat history is cleared. What would you like to discuss?", false, { remember: false });
      sound();
      return;
    }
    var safety = engine.classifySafety(value, state.previousInput);
    captureVisitorContext(value);
    state.previousInput = value;
    var strikes = safety ? safetyRecord(safety) : 0;
    if (safety && safety !== "language") {
      message(value, true, { remember: false });
      sound();
      if (strikes >= 2 || safety === "hate" || safety === "threat") {
        state.ended = true;
        finishConversation();
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
    offerPreapprovalUpload();
    if (state.profile.browsingEnded) {
      state.profile.browsingEnded = false;
      state.completed = false;
      persist();
    }
    if (/^(?:not interested|no longer interested|no thanks,?\s*(?:i'?m not interested)?|please (?:end|stop) (?:the )?chat)\s*[.!?]*$/i.test(value)) {
      state.booking = null;
      state.contact = null;
      finishConversation();
      message("Understood. I won't prompt you again. If you need us later, you can open this chat or call the team at 919-737-7896.", false);
      return;
    }
    if (!state.intent && !state.booking && !state.contact && /^(?:no|nope|nah|not really)(?:[,\s]+(?:just browsing|just looking|only browsing))?\s*[.!?]*$/i.test(value)) {
      if (state.profile.awaitingVisitReason) {
        endBrowsingConversation();
      } else {
        state.profile.awaitingVisitReason = true;
        persist();
        message("What has you looking at our website today?", false);
      }
      return;
    }
    if (state.profile.awaitingVisitReason) {
      state.profile.awaitingVisitReason = false;
      persist();
      if (!detectIntent(value) && !engine.asksQuestion(value) && !engine.wantsResources(value) && !engine.wantsBooking(value)) {
        if (/\b(?:mov(?:e|ing)|relocat\w*|buy\w*|sell\w*|invest\w*|homes?|houses?|properties?|neighborhoods?)\b/i.test(value)) {
          state.profile.awaitingVisitReason = true;
          persist();
          message("Are you thinking about a future move to Raleigh, or just exploring for now?", false);
        } else endBrowsingConversation();
        return;
      }
    }
    if (!state.booking && !state.contact && /^(?:hi|hello|hey|good morning|good afternoon|good evening|one sec(?:ond)?|just a sec(?:ond)?|let me think|hmm|um+)\s*[.!?]*$/i.test(value)) {
      var pendingQuestion = state.intent && state.question >= 0 && state.question < activeQuestions().length
        ? activeQuestions()[state.question].text : config.fallback;
      scheduleClarification("Hi! " + pendingQuestion);
      return;
    }
    var faq = engine.findFaq(value, config);
    if (isQuestionPreamble(value)) {
      state.questionDetour = true;
      persist();
      message("Absolutely, what's the question that you have?", false);
      return;
    }
    var directContactQuestion = asksForBenjaminNumber(value) || asksForTeamMember(value);
    var selectingTime = state.booking && state.booking.step === "choose" && /\b(?:first|second|one|two|1|2|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.test(value);
    if (state.questionDetour) {
      state.questionDetour = false;
      persist();
      faq = faq || engine.findFaq(value + "?", config);
      if (!selectingTime && (directContactQuestion || faq || engine.asksQuestion(value))) {
        answerSideQuestion(value, faq);
        return;
      }
    }
    if (asksToMeetNamedHost(value) && !directContactQuestion) {
      var namedHost = requestedPerson(value);
      state.profile.requestedHost = namedHost;
      persist();
      if (state.booking) {
        state.booking.preference.host = namedHost;
        state.booking.start = null;
        message("Absolutely. I'll check the next openings with " + namedHost + ".", false);
        state.booking.step = "loading";
        loadBookingSlots(state.booking);
      } else if (state.intent && state.question >= 0 && state.question < activeQuestions().length) {
        message("Absolutely. I'll help set up a call with " + namedHost + ". I have a few quick questions first so " + namedHost + " can prepare.", false);
        askQuestion();
      } else startBooking(value);
      return;
    }
    if (directContactQuestion || (state.booking && engine.asksQuestion(value) && !selectingTime)) {
      answerSideQuestion(value, faq);
      return;
    }
    if (state.booking) {
      if (faq && !selectingTime) answerSideQuestion(value, faq);
      else handleBookingAnswer(value);
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
    if (state.profile.pendingRentalPlan) {
      if (/\b(?:only|just|solely)\s+(?:looking\s+to\s+|interested\s+in\s+)?rent(?:ing)?\b|\bnot\s+(?:looking|planning|ready)\s+to\s+buy\b|\bdon't\s+(?:want|plan)\s+to\s+buy\b/i.test(value)) {
        explainRentalOnly();
      } else if (/\b(?:buy|buying|purchase|purchasing|permanent home|eventually|later|temporary|short.term|few months|while|then)\b/i.test(value)) {
        state.profile.pendingRentalPlan = false;
        state.profile.budgetKnown = false;
        askQuestion("That makes sense.");
      } else {
        message("Would you be renting briefly before buying, or are you only looking to rent?", false);
      }
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
    else scheduleClarification(config.fallback);
  }
  function clearConversation() {
    stopVoiceTyping();
    cancelClarification();
    interruptBotQueue();
    try { window.localStorage.removeItem(storageKey); } catch (_) { /* Storage may be unavailable. */ }
    state.intent = null;
    state.combined = false;
    state.question = -1;
    state.answers = [];
    state.profile = {};
    state.memories = {};
    state.memoryProfiles = {};
    state.history = [];
    state.hasUserMessage = false;
    state.completed = false;
    state.unreadCount = 0;
    state.badgeReadyAt = 0;
    if (badgeTimer) { window.clearTimeout(badgeTimer); badgeTimer = 0; }
    unreadBadge.hidden = true;
    state.contact = null;
    state.booking = null;
    state.offTrackOffer = false;
    state.ended = false;
    state.previousInput = "";
    attachment = null;
    attachmentInput.value = "";
    showAttachment();
    state.started = true;
    resumeQuestionOnOpen = false;
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
    cancelPulse();
    if (badgeTimer) { window.clearTimeout(badgeTimer); badgeTimer = 0; }
    unreadBadge.hidden = true;
    state.unreadCount = 0;
    state.badgeReadyAt = 0;
    persist();
    if (!state.hasUserMessage) {
      attentionSessionSet(openedWithoutReplyKey, 1);
      attentionSessionSet(pulseNextKey, Date.now() + 30000);
    }
    state.lastFocus = document.activeElement;
    state.sentMessageSinceOpen = false;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close Raleigh help chat");
    window.dispatchEvent(new CustomEvent("raleigh-chat-state", { detail: { blocked: true, reason: "custom_chat_open" } }));
    if (!state.started) {
      state.started = true;
      message(config.welcome, false);
    } else if (resumeQuestionOnOpen) {
      resumeQuestionOnOpen = false;
      if (state.profile.awaitingVisitReason) message("What has you looking at our website today?", false);
      else askQuestion();
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
    if (!state.hasUserMessage && !state.completed) attentionSessionSet(pulseNextKey, Date.now() + 30000);
    if (state.hasUserMessage && !state.completed) {
      state.unreadCount = 0;
      state.badgeReadyAt = Date.now() + 3000;
      persist();
    }
    refreshAttention();
    (state.lastFocus && state.lastFocus.focus ? state.lastFocus : launcher).focus();
  }
  launcher.addEventListener("click", function () { panel.hidden ? open() : close(); });
  input.addEventListener("input", function () {
    lastInputAt = Date.now();
    sizeInput(true);
    sendButton.disabled = state.submitting || state.ended || !input.value.trim();
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
    if (attachmentButton.hidden) return;
    attachmentInput.click();
  });
  attachmentInput.addEventListener("change", function () {
    var file = attachmentInput.files && attachmentInput.files[0];
    if (!file) return;
    if (attachmentButton.hidden) { attachmentInput.value = ""; return; }
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type) || file.size > 4 * 1024 * 1024) {
      attachmentInput.value = "";
      message("Please choose a JPG, PNG, WebP, or PDF under 4 MB.", false);
      return;
    }
    if (state.intent === "investing" || /^\/invest(?:\/|$)/i.test(window.location.pathname)) {
      attachmentInput.value = "";
      message("I can take a file with a Living in Raleigh contact request. For an investing question, please use the calculator message form.", false);
      return;
    }
    attachment = file;
    showAttachment();
    message("I've added " + file.name + ". I'll submit it for the team's review after your call is booked. If you choose to send a separate contact request instead, the file can go with that request.", false, { remember: false });
  });
  attachmentRemove.addEventListener("click", function () { attachment = null; attachmentInput.value = ""; showAttachment(); });
  newMessageButton.addEventListener("click", function () { log.scrollTop = log.scrollHeight; newMessageButton.hidden = true; });
  testResetButton.addEventListener("click", function () {
    if (state.submitting) return;
    clearConversation();
    try { window.localStorage.removeItem(safetyKey); } catch (_) {}
    try { window.localStorage.removeItem("livrBookingReportedAt"); } catch (_) {}
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
  refreshAttention();
})();
