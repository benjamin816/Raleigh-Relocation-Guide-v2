(function () {
  "use strict";
  var config = window.RaleighChatConfig;
  var engine = window.RaleighChatEngine;
  if (!config || !engine || document.querySelector(".rchat")) return;
  var path = window.location.pathname.replace(/index\.html$/, "");
  if (config.excludedPaths.indexOf(path) !== -1) return;
  var isTestSurface = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  var root = document.createElement("aside");
  root.className = "rchat";
  root.setAttribute("aria-label", "Raleigh website help");
  root.innerHTML =
    '<section class="rchat-panel" role="dialog" aria-label="Raleigh website help" aria-modal="false" hidden>' +
      '<header class="rchat-head"><img class="rchat-avatar" alt="" /><span class="rchat-head-copy"><strong class="rchat-head-title"></strong></span><button class="rchat-close" type="button" aria-label="Minimize chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7" /></svg></button></header>' +
      '<div class="rchat-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<button class="rchat-new" type="button" hidden>New message ↓</button>' +
      '<button class="rchat-test-reset" type="button" hidden>Reset test conversation</button>' +
      '<div class="rchat-test-ai" role="status" hidden></div>' +
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
    message("If you'd like the team to review your pre-approval before you meet, you can upload it using the paperclip below. That's completely optional.", false);
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

  var storageKey = config.conversationStorageKey || "raleigh-guide-chat-v1";
  var resumeQuestionOnOpen = false;
  var storageDays = Number.isInteger(config.conversationMemoryDays) ? Math.max(1, Math.min(config.conversationMemoryDays, 365)) : 180;
  var state = { intent: null, combined: false, question: -1, answers: [], profile: {}, memories: {}, memoryProfiles: {}, history: [], started: false, hasUserMessage: false, completed: false, unreadCount: 0, badgeReadyAt: 0, lastFocus: null, contact: null, booking: null, questionDetour: false, offTrackOffer: false, submitting: false, ended: false, sentMessageSinceOpen: false, previousInput: "" };
  var incomingGeneration = 0;
  var incomingSequence = 0;
  var incomingQueue = Promise.resolve();
  var aiStatus = root.querySelector('.rchat-test-ai');
  var understanding = config.understandingEnabled && (!config.understandingTestOnly||isTestSurface) && /^(localhost|127\.0\.0\.1|(?:www\.)?raleighncguide\.com)$/.test(window.location.hostname) && window.RaleighChatUnderstanding ?
    window.RaleighChatUnderstanding.create({endpoint:config.understandingEndpoint,knowledgeVersion:config.understandingKnowledgeVersion,engine:engine}) : null;
  if(understanding&&isTestSurface){aiStatus.hidden=false;aiStatus.style.cssText='font-size:11px;padding:4px 12px;color:#52645a;background:#f5f7f4';aiStatus.textContent='AI interpreter ready · existing bot is backup';}
  function trackConversation(eventName) {
    var tracker = window.__livrAnalyticsTracker;
    if (!tracker || typeof tracker.track !== 'function') return;
    var id = state.profile.analyticsConversationId;
    if (!id) { id = 'chat_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); state.profile.analyticsConversationId = id; }
    tracker.track(eventName, { interaction_source: (isTestSurface ? 'test-chat:' : 'chat:') + id, chat_conversation_id: id });
  }
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
      var delay = Math.max(0, state.badgeReadyAt - Date.now());
      if (delay) {
        unreadBadge.hidden = true;
        badgeTimer = window.setTimeout(refreshAttention, delay);
        return;
      }
      var count = state.unreadCount;
      unreadNumber.hidden = count === 0;
      unreadNumber.textContent = count > 99 ? "99+" : String(count);
      unreadCopy.textContent = count === 0 ? "CONTINUE CHAT" : count === 1 ? "NEW MESSAGE" : "NEW MESSAGES";
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
        if (Array.isArray(item.links)) entry.links=item.links.filter(function(l){return l && safeLink(l.href) && typeof l.label==='string';}).map(function(l){return {href:l.href,label:l.label.slice(0,80)};});
        message(entry.text, entry.byUser, { links:entry.links, at: entry.at, link: entry.link, restoring: true });
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
  var replyBurst = [];
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
    function check() {
      if (panel.hidden) { clarificationTimer = null; return; }
      if (Date.now() - lastInputAt < 3000) {
        clarificationTimer = window.setTimeout(check, 1000);
        return;
      }
      clarificationTimer = null;
      message(text, false);
    }
    clarificationTimer = window.setTimeout(check, 15000);
  }
  function interruptBotQueue() {
    replyBurst = [];
    messageGeneration += 1;
    botQueue = Promise.resolve();
    pendingBotMessages = 0;
    log.querySelectorAll(".rchat-row--typing").forEach(function (row) { row.remove(); });
  }
  function waitForVisitorPause(generation, minimumMs, row) {
    var visibleSince = Date.now();
    return new Promise(function (resolve) {
      function check() {
        if (generation !== messageGeneration) { resolve(); return; }
        if (Date.now() - lastInputAt < 3000) {
          row.remove();
          visibleSince = 0;
        } else if (!row.isConnected) {
          log.appendChild(row);
          visibleSince = Date.now();
          if (!panel.hidden) scrollToLatest();
        }
        if (visibleSince && Date.now() - visibleSince >= minimumMs) resolve();
        else window.setTimeout(check, 100);
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
            (Date.now() - lastUserSentAt >= replyDelay &&
             Date.now() - lastBotDeliveredAt >= betweenMessagesDelay &&
             Date.now() - lastInputAt >= 3000)) resolve();
        else window.setTimeout(check, 100);
      }
      check();
    });
  }
  function queueBotMessage(text, options, item) {
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
      if (!panel.hidden) scrollToLatest();
      if (falseStart) {
        await waitMs(700 + Math.round(Math.random() * 500));
        row.remove();
        if (generation !== messageGeneration) return;
        await waitMs(650 + Math.round(Math.random() * 550));
        if (generation !== messageGeneration) return;
        log.appendChild(row);
      }
      await waitForVisitorPause(generation, typingDuration, row);
      row.remove();
      if (generation === messageGeneration) {
        var historyBefore = state.history[state.history.length-1];
        item.bubble = renderMessage(item.text, false, item.options);
        if (state.history[state.history.length-1] !== historyBefore) item.historyEntry=state.history[state.history.length-1];
      }
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
      if (options.initial) return renderMessage(text, false, options);
      if (replyBurst.length >= 3) {
        var last = replyBurst[2];
        last.text += "\n\n" + text;
        last.options.links = (last.options.links || []).concat(options.link ? [options.link] : [], options.links || []);
        if (last.bubble) {
          var timestamp=last.bubble.querySelector("time");
          last.bubble.replaceChildren();
          appendReplyContent(last.bubble,last.text,last.options);
          if (timestamp) last.bubble.appendChild(timestamp);
          if (last.historyEntry) {last.historyEntry.text=redact(last.text);last.historyEntry.links=last.options.links;persist();}
          if (!panel.hidden) scrollToLatest();
        }
        return;
      }
      var item={text:String(text),options:Object.assign({},options)};
      replyBurst.push(item);
      queueBotMessage(text, options, item);
      return;
    }
    return renderMessage(text, byUser, options);
  }
  function appendReplyContent(bubble,text,options) {
    bubble.appendChild(document.createTextNode(text));
    var links=(options.link ? [options.link] : []).concat(options.links || []);
    links.forEach(function(item){
      if (!item || !safeLink(item.href)) return;
      var anchor=document.createElement("a");
      anchor.className="rchat-link";anchor.href=item.href;anchor.textContent=item.label;
      bubble.appendChild(anchor);
    });
  }
  function renderMessage(text, byUser, options) {
    options = options || {};
    var row = document.createElement("div");
    if(byUser&&!options.restoring)log.querySelectorAll('.rchat-read').forEach(function(receipt){receipt.remove();});
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
    appendReplyContent(bubble,text,options);
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
    if (!options.restoring && !panel.hidden) scrollToLatest();
    if (!options.restoring && options.remember !== false && !state.contact && !state.booking) {
      state.history.push({ text: redact(text), byUser: !!byUser, at: now.toISOString(), link: options.link || null, links:options.links || [] });
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
  function markLatestUserRead() {
    log.querySelectorAll('.rchat-read').forEach(function(receipt){receipt.remove();});
    var contents=log.querySelectorAll('.rchat-row--user .rchat-content');
    if(!contents.length)return;
    var receipt=document.createElement('span');
    receipt.className='rchat-read';receipt.textContent='Read';
    contents[contents.length-1].appendChild(receipt);
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
    if (config.bookingRelayUrl) return fetch(config.bookingRelayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: method, args: args || [] }), cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('Booking service is unavailable.');
      return response.json();
    }).then(function (message) { if (!message.ok) throw new Error(message.error || 'Booking is unavailable.'); return message.result; });
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
  function bookingDayKey(start) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(start));
  }
  function bookingSlotParts(start) {
    return Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(start)).map(function (part) { return [part.type, part.value]; }));
  }
  function requestedClock(value) {
    var text = String(value).toLowerCase();
    if (/\bnoon\b|\bmidday\b/.test(text)) return { hour: 12, minute: 0, meridiem: "pm" };
    var match = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)\b/i.exec(text);
    if (match) return { hour: Number(match[1]), minute: Number(match[2] || 0), meridiem: match[3].toLowerCase().charAt(0) + "m" };
    var implied = /\bat\s+(\d{1,2})(?::(\d{2}))?\b/.exec(text);
    if (!implied || Number(implied[1]) > 12) return null;
    return { hour: Number(implied[1]), minute: Number(implied[2] || 0), meridiem: Number(implied[1]) >= 9 && Number(implied[1]) < 12 ? "am" : "pm" };
  }
  function offeredBookingChoice(value, slots) {
    var text = String(value).toLowerCase().replace(/\b(mon|tues?|wed|thu|thurs?|fri|sat|sun)\b\.?/g,function(day){return {mon:'monday',tue:'tuesday',tues:'tuesday',wed:'wednesday',thu:'thursday',thur:'thursday',thurs:'thursday',fri:'friday',sat:'saturday',sun:'sunday'}[day.replace(/\.$/,'')]||day;});
    if (/\b(?:different|other|alternative|neither|don't work|do not work|doesn't work|does not work|not (?:the )?(?:first|second))\b/.test(text)) return null;
    var clock = requestedClock(text);
    var day = /\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(text);
    var explicitDate = /\b20\d{2}-\d{2}-\d{2}\b/.exec(text);
    if (/\b(?:earlier|early)\b/.test(text)) return slots[0] || null;
    if (/\b(?:later|late)\b/.test(text)) return slots[1] || null;
    var hasPeriod=/\b(?:morning|afternoon|evening|midday)\b/.test(text);
    var index = !clock && !day && !explicitDate && !hasPeriod && /\b(?:2|two|2nd|second|latter)\b/.test(text) ? 1 : !clock && !day && !explicitDate && !hasPeriod && /\b(?:1|one|1st|first|former)\b/.test(text) ? 0 : -1;
    if (index >= 0) return slots[index] || null;
    if (!day && !explicitDate && !clock) {
      var period=/\b(morning|afternoon|evening)\s+(?:option|one|time|slot)\b/.exec(text);
      if (period) { var choices=slots.filter(function(slot){var h=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date(slot.start)));return period[1]==='morning'?h<12:period[1]==='evening'?h>=17:h>=12&&h<17;}); return choices.length===1?choices[0]:null; }
      return null;
    }
    var today = bookingDayKey(new Date());
    var tomorrow = new Date(today + "T12:00:00Z");
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    var matches = slots.filter(function (slot) {
      var parts = bookingSlotParts(slot.start);
      var date = bookingDayKey(slot.start);
      if (explicitDate && date !== explicitDate[0]) return false;
      var h=Number(parts.hour)%12+(String(parts.dayPeriod).toLowerCase()==='pm'?12:0);
      if(hasPeriod && (/\bmorning\b/.test(text)?h>=12:/\bevening\b/.test(text)?h<17:/\bmidday\b/.test(text)?h<11||h>15:h<12||h>=17))return false;
      if (day && (day[1] === "today" ? date !== today : day[1] === "tomorrow" ? date !== tomorrow.toISOString().slice(0, 10) : parts.weekday.toLowerCase() !== day[1])) return false;
      return !clock || Number(parts.hour) === clock.hour && Number(parts.minute) === clock.minute && parts.dayPeriod.toLowerCase() === clock.meridiem;
    });
    var accepting = /\b(?:works|good|fine|great|perfect|take|choose|pick|book|yes|let'?s do|let us do|can do|that time|one|option)\b/i.test(text) ||
      /^(?:today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)[.!]?$/i.test(text.trim());
    accepting=accepting || /\bplease\b/.test(text)&& !/\?|\b(?:any|options|do you have)\b/.test(text);
    return (clock || accepting) && matches.length === 1 ? matches[0] : null;
  }
  function normalizeSuggestedTime(value) {
    var dated = /\b(\d{4}-\d\d-\d\d\s+\d{1,2}(?::\d\d)?\s*(?:am|pm)(?:\s*(?:ET|Eastern))?)\b/i.exec(value);
    if (dated) return dated[1];
    var match = /\b(today|tomorrow|next\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\s+(?:at\s+)?(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)|(noon|midday)|at\s+(\d{1,2})(?::(\d{2}))?)\b/i.exec(value);
    if (!match) return value;
    var parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", weekday: "long" }).formatToParts(new Date()).map(function (part) { return [part.type, part.value]; }));
    var date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    if (/^tomorrow$/i.test(match[1])) date.setUTCDate(date.getUTCDate() + 1);
    else if (!/^today$/i.test(match[1])) {
      var weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      var wanted = weekdays.findIndex(function (day) { return day.startsWith(match[1].replace(/^next\s+/i, "").toLowerCase().slice(0, 3)); });
      if (wanted < 0) return value;
      var ahead = (wanted - date.getUTCDay() + 7) % 7;
      date.setUTCDate(date.getUTCDate() + (ahead || 7) + (/^next\s+/i.test(match[1]) && ahead ? 7 : 0));
    }
    var inferred = match[6] ? Number(match[6]) >= 9 && Number(match[6]) < 12 ? "am" : "pm" : "";
    return date.toISOString().slice(0, 10) + " " + (match[5] ? "12pm" : match[6] ? match[6] + (match[7] ? ":" + match[7] : "") + inferred : match[2] + (match[3] ? ":" + match[3] : "") + match[4].toLowerCase().charAt(0) + "m") + " ET";
  }
  function bookingPreferenceFromText(value, current) {
    var next = Object.assign({ host: "", daypart: "", weekdays: [], date: "" }, current || {});
    if (/\b(no preference|any time|any day|whoever is available)\b/i.test(value)) return { host: "", daypart: "", weekdays: [], date: "" };
    var namedHost=String(value).match(/\b(?:recommended|prefer|with|instead of)\s+(?:a call with\s+)?(Benjamin|Ben|Ricardo)\b/i);
    if(namedHost)next.host=/^ricardo$/i.test(namedHost[1])?'Ricardo':'Benjamin';
    if (/\b(?:benjamin|ben)\b/i.test(value) && !/\bricardo\b/i.test(value)) next.host = "Benjamin";
    if (/\bricardo\b/i.test(value) && !/\b(?:benjamin|ben)\b/i.test(value)) next.host = "Ricardo";
    if (/\bmornings?\b/i.test(value)) next.daypart = "morning";
    if (/\bafternoons?\b/i.test(value)) next.daypart = "afternoon";
    if (/\b(?:midday|lunchtime|lunch time|around lunch|noon)\b/i.test(value)) next.daypart = "midday";
    if (/\bevenings?\b|\bafter (?:5|five)\b/i.test(value)) next.daypart = "evening";
    if (requestedClock(value) && !/\b(?:mornings?|afternoons?|evenings?)\b/i.test(value)) next.daypart = "";
    if (/\bweekends?\b/i.test(value)) { next.weekdays = [0, 6]; next.date = ""; }
    else if (/\bweekdays?\b/i.test(value)) { next.weekdays = [1, 2, 3, 4, 5]; next.date = ""; }
    else {
      var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      var requested = days.map(function (day, index) { return new RegExp("\\b" + day + "s?\\b", "i").test(value) ? index : -1; }).filter(function (day) { return day >= 0; });
      if (requested.length) { next.weekdays = requested; next.date = ""; }
    }
    var exactDate = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(value);
    if (exactDate) { next.date = exactDate[1]; next.weekdays = []; }
    var nextWeekday = /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(value);
    if (nextWeekday && !exactDate) {
      var currentDay = bookingDayKey(new Date());
      var nextDate = new Date(currentDay + "T12:00:00Z");
      var names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      var difference = (names.indexOf(nextWeekday[1].toLowerCase()) - nextDate.getUTCDay() + 7) % 7;
      nextDate.setUTCDate(nextDate.getUTCDate() + (difference || 7) + (difference ? 7 : 0));
      next.date = nextDate.toISOString().slice(0, 10);
      next.weekdays = [];
    }
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
    return /\b(?:benjamin|ben|ricardo|morning|afternoon|evening|midday|lunchtime|noon|weekend|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday|tomorrow|today|after (?:5|five))s?\b/i.test(value) || /\b20\d{2}-\d{2}-\d{2}\b/.test(value);
  }
  function bookingFailed(error) {
    state.booking = null;
    if (error && /Chat booking is paused for testing/.test(error.message || '')) {
      message("I'm showing the team's real openings while we test, but I can't create an appointment here right now. No appointment was booked. Please call us at 919-737-7896 if you'd like to schedule one.", false);
    } else {
      message("I can't confirm a calendar time right now. I can pass your details to the team instead, or you can call us at 919-737-7896.", false);
    }
    if (window.console && error) console.warn("Chat booking unavailable:", error.message || error);
  }
  function offerBookingSlots(slots) {
    if (!state.booking) return;
    state.booking.referralSupported = Array.isArray(slots) && slots.length > 0 && slots.every(function(slot){return slot.referralMinutes === 15;});
    state.booking.allSlots = Array.isArray(slots) ? slots.slice(0, 6) : [];
    state.booking.offset = 0;
    showBookingPair();
  }
  function showBookingPair() {
    if (!state.booking) return;
    var available = state.booking.allSlots.slice(state.booking.offset);
    var oneRequestedDay = !!state.booking.preference.date || state.booking.preference.weekdays.length === 1;
    if (oneRequestedDay) {
      available.sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
      if (available.length) {
        var soonestDay = bookingDayKey(available[0].start);
        available = available.filter(function (slot) { return bookingDayKey(slot.start) === soonestDay; });
      }
    }
    var nearestRequested = oneRequestedDay && !!state.booking.closestClock;
    if (nearestRequested) {
      var desired = state.booking.closestClock;
      var desiredMinutes = (desired.hour % 12 + (desired.meridiem === "pm" ? 12 : 0)) * 60 + desired.minute;
      available.sort(function (a, b) {
        function distance(slot) {
          var parts = bookingSlotParts(slot.start);
          var minutes = (Number(parts.hour) % 12 + (parts.dayPeriod.toLowerCase() === "pm" ? 12 : 0)) * 60 + Number(parts.minute);
          return Math.abs(minutes - desiredMinutes);
        }
        return distance(a) - distance(b) || new Date(a.start) - new Date(b.start);
      });
    }
    var first = available[0];
    var firstDay = first && bookingDayKey(first.start);
    function isDifferentDay(slot) {
      return bookingDayKey(slot.start) !== firstDay;
    }
    var differentDay = first && (available.slice(1).find(function (slot) { return isDifferentDay(slot) && slot.daypart !== first.daypart; }) ||
      available.slice(1).find(isDifferentDay));
    var sameDayVariety = first && available.slice(1).find(function (slot) { return slot.daypart !== first.daypart; });
    var second = state.booking.closestClock ? null : oneRequestedDay ? (sameDayVariety || available[1]) : (differentDay || sameDayVariety || available[1]);
    state.booking.closestClock = null;
    state.booking.slots = first ? [first].concat(second ? [second] : []) : [];
    state.booking.step = "choose";
    if (!state.booking.slots.length) {
      message("I don't see an opening for that day. Is there another day that could work for you?", false);
      return;
    }
    message((nearestRequested ? "The closest opening I found is " : "We have ") + state.booking.slots.map(function (slot, index) {
      return (index === 0 ? "" : " or ") + bookingLabel(slot.start);
    }).join("") + ". " + (nearestRequested ? "Would that work for you?" : (config.bookingChoicePrompt || "Which time works for you? Let me know if you'd prefer a video or phone call.")), false);
  }
  function requestContactPermission(action) {
    state.profile.pendingContactPermission = action;
    persist();
    message(action === 'booking' ? "Booking a call requires your name, email, and phone number. Would you like to continue, or keep chatting without sharing those details?" :
      "To send a message to the team, I'd need your contact details. May I ask for those, or would you prefer to keep chatting anonymously?", false);
  }
  function informationalReply(value, approvedAnswer) {
    state.profile.informationOnly = true;
    state.question = -1;
    var first = !state.profile.informationalIntroShown;
    var faq = value && engine.findFaq(value, config);
    var flow = config.flows[state.intent];
    var guidance = informationalGuidance(value);
    if(approvedAnswer)message(approvedAnswer.answer,false);
    else if (value && /calculator/i.test(value)) { message('Yes, here is the investment calculator.',false); link('Open the investment calculator','/calculator/'); }
    else if (value && (asksForBenjaminNumber(value) || asksForTeamMember(value))) message("You can call or text the team at " + (config.benjaminDirectPhone || '919-737-7896') + ".", false);
    else if (guidance) message(guidance, false);
    else if (faq && !/exploration call|book a call|schedule a call/i.test(faq.answer)) message(faq.answer, false);
    else if (value && /\b(?:home|house|property)\b.{0,30}\b(?:worth|value)\b/i.test(value))
      message("A useful home valuation needs property details and recent comparable sales. I can't give you a reliable price in this chat.", false);
    else message(first ? "That's completely fine—we can keep this informational. You don't need to schedule a call or share contact details. What would you like to know?" :
      "I'm happy to help with general Raleigh questions. What would you like to understand next?", false);
    if (flow && flow.resourceLink && (state.profile.researchOnly && first || value && engine.wantsResources(value))) link(flow.resourceLink.label, flow.resourceLink.href);
    state.profile.informationalIntroShown = true;
    finishConversation();
    persist();
  }
  function informationalGuidance(value) {
    var text = String(value || '').toLowerCase();
    var answer = (config.informationalAnswers || []).find(function (item) {
      return new RegExp(item.pattern, 'i').test(text);
    });
    return answer ? answer.answer : '';
  }
  function startBooking(request) {
    if (state.profile.noScheduling || state.profile.researchOnly) {
      message("Of course—we can keep this to your questions without scheduling a call. What else would you like to know?", false);
      return;
    }
    if (state.profile.noContact) { requestContactPermission('booking'); return; }
    var currentFlow = state.intent && config.flows[state.intent];
    if (currentFlow && currentFlow.booking === "investing") {
      message("Investing calls are booked through our investor page, where you can choose the time that works for you.", false);
      link("Book an investing exploration call", config.bookingLinks.investing);
      return;
    }
    if (!config.bookingBridgeUrl && !config.bookingRelayUrl) {
      message("I can't check the calendar from chat right now. I can pass your details to the team, or you can call 919-737-7896.", false);
      return;
    }
    if (state.booking) return;
    var earlierHostRequest = !request && state.history.slice(-12).reverse().find(function (entry) {
      return entry.byUser && Date.now() - Date.parse(entry.at) < 2 * 3600000 &&
        /\b(?:prefer|request|book|speak|meet|call|work with)\b.{0,60}\b(?:benjamin|ben|ricardo)\b/i.test(entry.text);
    });
    var requestedPreference = bookingPreferenceFromText(request || (earlierHostRequest && earlierHostRequest.text) || "", state.profile.bookingPreference);
    if (!requestedPreference.host && state.profile.requestedHost) requestedPreference.host = state.profile.requestedHost;
    if (!config.chatRoundRobinBookingEnabled && requestedPreference.host) {
      message("I can't guarantee a call with a specific team member from chat yet. Please call 919-737-7896 and we'll find a time with " + requestedPreference.host + ".", false);
      return;
    }
    state.booking = { step: "loading", slots: [], allSlots: [], offset: 0, details: {},
      preference: requestedPreference };
    if(state.profile.preferredCallType==='phone')state.booking.details.callType='phone';
    if (state.profile.outOfStateReferral) { state.booking.referral = true; state.booking.details.callType = "phone"; }
    var formatRequest=(request || "").replace(/\b(?:instead of|rather than|not|no)\s+(?:a\s+)?(?:video|zoom|google meet|virtual|phone|telephone)(?:\s+call)?\b/gi, "");
    if (/\b(phone|telephone)\b/i.test(formatRequest)) state.booking.details.callType = "phone";
    else if (config.chatVideoBookingEnabled && /\b(video|zoom|google meet|virtual)\b/i.test(formatRequest)) state.booking.details.callType = "video";
    loadBookingSlots(state.booking);
  }
  function loadBookingSlots(booking) {
    var followUp = booking.step === "choose";
    var searchId = booking.slotSearchId = (booking.slotSearchId || 0) + 1;
    booking.step = "loading";
    if (followUp) message("Let me check.", false);
    bookingCall("slots", config.chatRoundRobinBookingEnabled ? [booking.preference] : []).then(function (slots) {
      if (state.booking !== booking || booking.slotSearchId !== searchId) return;
      if (config.chatRoundRobinBookingEnabled && booking.preference.weekdays.length === 1 &&
          !booking.preference.date && Array.isArray(slots) && slots.length) {
        var earliest = slots.map(function (slot) { return bookingDayKey(slot.start); }).sort()[0];
        return bookingCall("slots", [{ host: booking.preference.host, daypart: booking.preference.daypart, date: earliest }])
          .then(function (sameDaySlots) {
            if (state.booking === booking && booking.slotSearchId === searchId) offerBookingSlots(sameDaySlots);
          });
      }
      offerBookingSlots(slots);
    }).catch(function (error) {
      if (state.booking === booking && booking.slotSearchId === searchId) bookingFailed(error);
    });
  }
  function handleBookingAnswer(value) {
    var booking = state.booking;
    if(booking.step==='choose') {
      value=String(value).replace(/\b(?:not|no)\s+(?:on\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,' ').replace(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:does not|doesn't|won't|will not)\s+work\b/gi,' ');
    }
    if (booking.referral && /\b(video|zoom|meet|virtual)\b/i.test(value)) {
      message("This referral appointment is a quick phone call to learn about your current home. Would you like to continue with that, or contact the team at 919-737-7896 about another format?", false); return;
    }
    var formatValue=value.replace(/\b(?:instead of|rather than|not|no)\s+(?:a\s+)?(?:video|zoom|google meet|virtual|phone|telephone)(?:\s+call)?\b/gi, "");
    if (/\b(video|zoom|meet|virtual)\b/i.test(formatValue)) booking.details.callType = "video";
    else if (/\b(phone|telephone|call me)\b/i.test(formatValue)) booking.details.callType = "phone";
    if (engine.cancelsScheduling(value) || engine.declinesScheduling(value)) {
      state.booking = null;
      state.profile.noScheduling = true;
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
      if (/\b(?:more|other|another|different|alternative)\s+(?:times?|options?|slots?|openings?)\b/i.test(value) || /^more[.!?]*$/i.test(value) || /\b(?:neither|those (?:two )?(?:don't|do not) work)\b/i.test(value)) {
        booking.offset = booking.offset + 2 < booking.allSlots.length ? booking.offset + 2 : 0;
        showBookingPair();
        return;
      }
      var choiceText = value.replace(/\b(?:for|as|on|by)?\s*(?:a\s+)?(?:video|zoom|google meet|virtual|phone|telephone)\s*call\b|\b(?:video|zoom|google meet|virtual|phone|telephone)\b|\s+(?:with|for)\s+(?:benjamin|ben|ricardo)\b/gi, "").trim();
      var choice = offeredBookingChoice(choiceText, booking.slots);
      if (config.chatRoundRobinBookingEnabled && hasBookingPreference(value)) booking.preference = bookingPreferenceFromText(value, booking.preference);
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
      if ((/\b(?:works|good|fine|great|perfect|take|choose|pick|book|yes|let'?s do|let us do|can do)\b/i.test(choiceText) ||
          /^(?:today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)[.!]?$/i.test(choiceText)) &&
          /\b(?:today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(choiceText) &&
          booking.slots.length > 1 && bookingDayKey(booking.slots[0].start) === bookingDayKey(booking.slots[1].start) &&
          offeredBookingChoice(choiceText, [booking.slots[0]])) {
        message("Both of those times are on that day. Would the earlier or later time work better?", false);
        return;
      }
      if (config.chatRoundRobinBookingEnabled && hasBookingPreference(value) && !requestedClock(choiceText) &&
          !/^\d{4}-\d\d-\d\d\s+\d/i.test(choiceText)) {
        loadBookingSlots(booking);
        return;
      }
      if (!requestedClock(value) && !/\b20\d{2}-\d{2}-\d{2}\s+\d/.test(value)) {
        message("Would either of the offered times work, or would you like a different day and time?",false);
        return;
      }
      booking.step = "checking";
      bookingCall("suggest", config.chatRoundRobinBookingEnabled
        ? [normalizeSuggestedTime(value), { host: booking.preference.host }]
        : [normalizeSuggestedTime(value)]).then(function (result) {
        if (!state.booking || state.booking !== booking) return;
        if (!result || !result.available) {
          booking.step = "choose";
          if (hasBookingPreference(value)) {
            booking.closestClock = requestedClock(value);
            message("I don't see that exact time open. Let me check the nearest options on that day.", false);
            loadBookingSlots(booking);
          } else message("That time isn't available. Would one of the times I offered work, or is there another day you'd like me to check?", false);
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
      if (!state.profile.transactionGoal && !state.intent) {
        booking.step = "purpose";
        message("Will this call be about buying, selling, or both?",false);
        return;
      }
      booking.step = "notes";
      message("Anything you'd like us to know before the call? You can type skip.", false);
      return;
    }
    if (booking.step === "purpose") {
      var goal = engine.detectIntent(value,config);
      if (/^both[.!]*$/i.test(value.trim())) goal={id:'selling',combined:true};
      if (!goal) { message("Is this for buying a home, selling a home, or both?",false); return; }
      if (goal.id==='investing') { state.booking=null; state.intent='investing'; message("Investing consultations are booked on our investor page.",false); link("Book an investing call",config.bookingLinks.investing); return; }
      state.intent=goal.id; state.combined=!!goal.combined; state.profile.transactionGoal=goal.id;
      booking.step="notes";
      message("Anything you'd like us to know before the call? You can type skip.",false);
      return;
    }
    if (booking.step === "notes") {
      if (!state.profile.transactionGoal && !state.intent) { booking.step="purpose"; message("Before I book, is the call about buying, selling, or both?",false); return; }
      booking.details.notes = /^skip$/i.test(value) ? "" : value.slice(0, 1000);
      booking.step = "confirming";
      if (booking.referral && !booking.referralSupported) {
        message("I can read the team's openings, but the short referral-call booking option is still being connected. No appointment has been booked. You can call or text 919-737-7896 to arrange that quick phone call.", false);
        return;
      }
      if (booking.referral) booking.details.notes = config.sellerReferral.notesLabel + " Current home: " + (state.profile.origin || "out of state") + ". " + booking.details.notes;
      booking.requestId = booking.requestId || bookingToken();
      message("I'll book that time now and send the invitation to your email.", false);
      bookingCall("book", [{ requestId: booking.requestId, appointmentType: booking.referral ? "seller_referral" : "exploration", durationMinutes: booking.referral ? 15 : 60, start: booking.start, name: booking.details.name, email: booking.details.email, phone: booking.details.phone, notes: booking.details.notes, callType: booking.details.callType, purpose: state.combined ? "Buy and Sell" : (state.profile.transactionGoal || state.intent) === "selling" ? "Sell" : state.intent === "investing" ? "Invest" : "Buy", preferredHost: config.chatRoundRobinBookingEnabled ? booking.preference.host : "" }]).then(function (result) {
        if (state.booking !== booking) return;
        if (!result || !result.booked) throw new Error("Booking was not confirmed.");
        trackConversation('chat_appointment_booked');
        var bookingFile = attachment;
        attachment = null;
        attachmentInput.value = "";
        showAttachment();
        state.booking = null;
        try { window.localStorage.setItem("livrBookingReportedAt", new Date().toISOString()); } catch (_) {}
        finishConversation();
        window.dispatchEvent(new CustomEvent("raleigh-booking-confirmed", { detail: { source: "website_chat" } }));
        if (booking.referral) message("Great, " + booking.details.name.split(/\s+/)[0] + ", you're confirmed for a 15-minute phone call on " + bookingLabel(result.start) + " with " + (result.assignedHost || "the team") + ". You'll get a calendar invitation. We'll learn more about your current home and help connect you with the right listing agent. You can call or text us at 919-737-7896 if you need anything before then.", false);
        else message("Great, " + booking.details.name.split(/\s+/)[0] + ", I've got you confirmed for " + bookingLabel(result.start) + " with " + (result.assignedHost || "the team") + ". You'll get a calendar invitation." + (booking.details.callType === "video" ? (result.videoUrl ? " The Google Meet link is in the invitation." : " The team will add the video link before your call.") : "") + " Look out for an email titled What To Know Before Our Call, with a quick form and resources to help you prepare. If you need anything in the meantime, message me here or call or text the team at 919-737-7896.", false);
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
    var profile = id === state.intent ? state.profile : state.memoryProfiles[id] || {};
    var facts = profile.facts || {};
    var known = flow && flow.questions.filter(function (question) { return facts[question.key]; });
    if (known && known.length) return known.slice(0, 3).map(function (question) {
      var answer = facts[question.key];
      if (typeof answer === 'object') answer = answer.place || answer.type;
      return 'You told me “' + answer + '” about “' + question.text + '”.';
    }).join(' ');
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
    var visitorName = state.profile.firstName;
    var introAsked = state.profile.introAsked;
    state.profile = Object.assign({}, state.profile, { firstName: visitorName || "", introAsked: !!introAsked });
    if (sourceText) { captureVisitorContext(sourceText); markPreapproval(sourceText); }
    applyKnownFacts();
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
      message(introAsked ? originQuestion : opening + ", " + originQuestion.charAt(0).toLowerCase() + originQuestion.slice(1), false);
      return;
    }
    if (!knownLocation && !introAsked) message(state.combined && flow.combinedIntro ? flow.combinedIntro : flow.intro, false);
    offerPreapprovalUpload();
    askQuestion(knownLocation && !introAsked ? locationAcknowledgement(knownLocation) : "");
  }
  function locationAcknowledgement(location) {
    if (state.intent === "investing") return location.type === "local" ? "Great!" : "Awesome.";
    if (location.type === "local") return "Great.";
    if (location.city && location.stateCode === "TX") return (config.relocationResponses || {}).cityTexas || "Oh, Texas? That's awesome.";
    if (location.city && location.stateCode) return "Oh, " + config.originStates[location.stateCode] + "? That's awesome.";
    var place = (location.place || "").toLowerCase();
    return (config.originAcknowledgements || {})[place] || (location.type === "out" ? "Awesome." : "Great.");
  }
  function originLabel() {
    if (state.profile.originCode && (config.originStates || {})[state.profile.originCode]) return config.originStates[state.profile.originCode];
    return (state.profile.origin || "").replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });
  }
  function askQuestion(prefix) {
    var flow = config.flows[state.intent];
    if (!flow) return;
    applyKnownFacts();
    var ambiguousOrigin = !state.profile.originCode && !state.profile.originDisambiguationDeclined &&
      (config.originAmbiguousCities || []).find(function (city) { return city.toLowerCase() === (state.profile.origin || '').toLowerCase(); });
    if (ambiguousOrigin) {
      state.profile.awaitingOriginState = ambiguousOrigin;
      var options = (config.originCityOptions || {})[ambiguousOrigin.toLowerCase()];
      message(options ? "Just to make sure: " + ambiguousOrigin + ", " + options.join(' or ') + "—or a different state?" : "Which state is " + ambiguousOrigin + " in?", false);
      return;
    }
    var questions = activeQuestions();
    state.question = questions.findIndex(function(item){return !knownAnswer(item.key);});
    if (state.question < 0) state.question = questions.length;
    if (state.question >= questions.length) {
      if (state.profile.noScheduling || state.profile.researchOnly) { informationalReply(); return; }
      var sellerSummer = state.intent === "selling" && /\bnext summer\b/i.test(state.profile.targetTiming || "");
      var buyerSummer = /^(buying|relocating)$/.test(state.intent) && /\bsummer\b/i.test(state.profile.targetTiming || "");
      var finish = state.profile.researchTimeline ? config.conversationResponses.researchTimeline : state.profile.saleOnly && !state.profile.sellThenRent ? "An exploration call with the team can help you put together a game plan for your sale, preparation, and timing." : state.profile.sellThenRent ? "An exploration call can help plan your sale and the transition to renting. We can keep the discussion focused on sale logistics." : state.profile.sensitiveMove ? "We can keep personal details private. An exploration call can focus on the practical steps and timing for your move." : state.profile.shortTiming ? "Well, great. Based on that timing, we should absolutely set up an exploration call with the team to help build you a game plan around your move." : sellerSummer ? (flow.finishNextSummer || flow.finish) : buyerSummer ? "That's a great time to make the move. That's typically when we see the most options on the buy side here in our market, and it's often one of the best times to sell. A one-on-one conversation with the team would be a great next step to build a game plan around your move." : (prefix ? prefix + " " : "") + flow.finish;
      message(finish, false);
      if (flow.booking === "general") startBooking();
      else link("Book an investing exploration call", config.bookingLinks.investing);
      return;
    }
    var question = questions[state.question];
    state.profile.currentQuestionKey = question.key;
    var variants = [question.text].concat(Array.isArray(question.alternatives) ? question.alternatives.filter(Boolean) : []);
    var wording = variants[state.answers.length % variants.length] || question.text;
    if (question.key === 'salePriority' && state.profile.facts.currentHome) wording = "You mentioned selling your rental in " + state.profile.facts.currentHome + ". Should we focus on that sale, your next investment, or both?";
    if (/^(buying|relocating)$/.test(state.intent) && state.profile.location === "out") {
      if (question.key === "whyRaleigh") wording = !state.profile.origin ? "Where are you moving from, and what's drawing you to Raleigh?" : state.profile.originCity ? "What has you making the move?" : "What has you looking at moving to Raleigh from " + originLabel() + "?";
      if (question.key === "originHousing") wording = "Do you have a home" + (state.profile.origin ? " in " + originLabel() : " there") + " that you'd need to sell, or are you currently renting?";
      if (question.key === "areas") wording = "What areas around Raleigh are you interested in buying a home in?";
      if (question.key === "familyNearby" || question.key === "priorityFamilyArea") wording = state.profile.nearbyPerson === "friends" ? "What part of the Raleigh area are your friends in?" : "What part of the Raleigh area is your family in?";
      if ((question.key === "familyNearby" || question.key === "priorityFamilyArea") && state.profile.sensitiveFamilyReason) wording = "What part of the Raleigh area does your family live in?";
    }
    if (question.key === "priorityMore") {
      var suppliedArea = [state.profile.facts.priorities, state.profile.facts.priorityMore].filter(Boolean).join(" ");
      var areaExamples = [
        {label:"nearby amenities", pattern:/\b(?:amenities|parks?|trails?|greenways?)\b/i},
        {label:"shopping & dining", pattern:/\b(?:shopping|shops?|groceries|stores?|dining|restaurants?)\b/i},
        {label:"schools", pattern:/\bschools?\b/i, omit:state.profile.retired || state.profile.noChildren},
        {label:"your commute", pattern:/\bcommut(?:e|ing)\b/i, omit:state.profile.remoteWork || state.profile.retired}
      ].filter(function(item){return !item.omit && !item.pattern.test(suppliedArea);}).map(function(item){return item.label;});
      wording = "Is there anything else that's super important to you about the area" + (areaExamples.length ? ", like " + areaExamples.join(", ") : "") + "?";
      var initialPriorities=String(state.profile.facts.priorities||'');
      if(engine.uncertainArea(initialPriorities)&&areaExamples.length){
        prefix='';
        var suggestions=areaExamples.length>1?areaExamples.slice(0,-1).join(', ')+', or '+areaExamples[areaExamples.length-1]:areaExamples.join('');
        wording="Totally get it - how about things like "+suggestions+"?";
      }
    }
    if (question.key === "commuteRange" && /\b(?:RTP|Research Triangle Park)\b/i.test(state.profile.commuteDestination || "")) {
      prefix = "";
      wording = "Should have known, haha! Research Triangle Park—RTP. Is around 30 minutes your comfort limit for a daily commute, or would you prefer something shorter or be comfortable with longer?";
    }
    if (question.key === "home" && state.profile.homeDetailsGiven) wording = state.profile.facts && state.profile.facts.home ?
      "You mentioned " + state.profile.facts.home + ". Is there anything else that's important to you about the home itself?" :
      "You mentioned some home features earlier. Is there anything else that's important to you about the home itself?";
    if (question.key === "homeMore") {
      var homeAnswer = String(state.profile.homeLastAnswer || "").toLowerCase();
      var examples = [
        { pattern: /\b(?:bed|bedroom)/, label: "bedrooms" },
        { pattern: /\b(?:bath|bathroom)/, label: "bathrooms" },
        { pattern: /\b(?:sq\.?\s?ft|square feet|square footage)/, label: "square footage" },
        { pattern: /\b(?:yard|backyard|lot)/, label: "yard size" },
        { pattern: /\b(?:ranch|one.story|single.story|two.story|layout)/, label: "a one- or two-story layout" }
      ].filter(function (item) { return !item.pattern.test(homeAnswer); }).map(function (item) { return item.label; });
      if (examples.length) wording = "Besides what you mentioned, is there anything else you'd want in the home, like " + examples.slice(0, 3).join(", ") + "?";
    }
    if ((question.key === "budget" || question.key === "priorityBudget") && state.profile.preApproved) wording = "I know you said you're pre-approved. What price would feel comfortable to you, regardless of the pre-approval amount?";
    if ((question.key === "priorityFinancing" || question.key === "financing") && state.profile.originSale) wording = "Do you think you'll buy with cash from the sale of your current home, or use financing?";
    else if (question.key === "priorityFinancing" || question.key === "financing") wording = "Do you plan on using financing, or will you be buying in cash?";
    if (question.key === "areas" && state.profile.priorityAnswered) wording = "Are there any specific areas around Raleigh that you're interested in buying a home in?";
    if (question.key === "areasReason" && state.profile.areasPlural) wording = "What was it about those areas that stood out to you?";
    if (question.key === "areasReason" && state.profile.familyArea && state.profile.areasMentionFamilyArea) wording += " I know you mentioned having family in " + state.profile.familyArea + ".";
    if (question.key === "timing" && state.profile.justDiscussedUncertainFunding) {
      wording = config.conversationResponses.fundingTimelineLead;
      prefix = "";
      state.profile.justDiscussedUncertainFunding = false;
    }
    var personal = state.profile.firstName && (question.key === "areas" || question.key === "timing")
      ? state.profile.firstName + ", " : "";
    if (personal) wording = wording.charAt(0).toLowerCase() + wording.slice(1);
    if (prefix) {
      if (prefix === state.profile.lastAcknowledgement) {
        var alternatives = ["Understood.", "Okay.", "Thanks for sharing that."];
        prefix = alternatives[(state.profile.ackVariation || 0) % alternatives.length];
        state.profile.ackVariation = (state.profile.ackVariation || 0) + 1;
      }
      state.profile.lastAcknowledgement = prefix;
    }
    message((prefix ? prefix + " " : "") + personal + wording, false);
  }
  function answerAcknowledgement(question, answer) {
    if (engine.isSensitiveFamilyReason(answer)) return "I'm so sorry to hear that." + (state.profile.familyNearby ? " It makes sense that you'd want to be closer to your family." : "");
    if (state.profile.sensitiveMove) return /^(?:timing|nextDestination|whySell|whySellSolo|ownedYears|timingReason)$/.test(question && question.key) ? "Understood." : "Got it.";
    if (!question) return "Got it.";
    var text = String(answer || "").toLowerCase();
    switch (question.key) {
      case "currentArea": return /north raleigh/.test(text) ? "North Raleigh is a great area!" : "Okay, great.";
      case "firstTime": return !/^no\b/.test(text) && /\b(yes|first|never)\b/.test(text) ? "That's super exciting!" : "Got it.";
      case "leaseEnd": return "Got it.";
      case "whyRaleigh": {
        if (engine.isSensitiveFamilyReason(answer)) return "I'm so sorry to hear that." + (state.profile.familyNearby ? " It makes sense that you'd want to be closer to your family." : "");
        if (/^(buying|relocating)$/.test(state.intent)) {
          var responses = config.relocationResponses || {};
          if (state.profile.newJob) return responses.job || "Congrats! That's super exciting.";
          if (state.profile.familyNearby) return responses.family || "Oh, awesome.";
          if (/\b(price|prices|cost of living|affordab\w*|cheaper|less expensive|more for (?:my|the|our) money)\b/.test(text)) {
            return state.profile.originCode === "CA" ? (responses.californiaPrice || responses.price || "Fair enough!") : (responses.price || "Fair enough!");
          }
          if (/\b(weather|warm|warmer|climate|seasons?|cold|winter)\b/.test(text)) return state.profile.originCode === "MN" ? "Oh, Minnesota! If you're ready for a break from the snow, Raleigh's milder winters could be a welcome change." : responses.weather || "Totally get that.";
        }
        return /\b(warm|weather|commute)\b/.test(text) ? "That makes sense!" : "I totally understand.";
      }
      case "jobLocation": return "Okay, awesome.";
      case "jobStart": return "Great.";
      case "familyNearby": case "priorityFamilyArea": return state.profile.sensitiveFamilyReason ? "Thanks for sharing that." : state.profile.familyArea ? "That's a great area!" : "Got it.";
      case "currentHome": return /north raleigh/.test(text) ? "North Raleigh is a great area!" : "Okay, great.";
      case "ownedYears": { var years = parseInt(text, 10); return years >= 5 || /\b(five|six|seven|eight|nine|ten|eleven|twelve)\b/.test(text) ? "Wow, you've been there a while!" : "Okay, got it."; }
      case "whySell": case "whySellSolo": return /\b(family|relatives)\b/.test(text) ? "I totally understand." : "That makes sense.";
      case "nextDestination": return state.profile.saleOnly ? 'Understood.' : "That's exciting!";
      case "nextAreaReason": return "I can see why that appeals to you.";
      case "experience": return /\b(first|new|never)\b/.test(text) ? "That's super exciting!" : "Great, good to know.";
      case "strategy": return "Okay, got it.";
      case "sellingExperience": return /\b(first|never)\b/.test(text) ? "Okay, wonderful." : "Great, good to know.";
      case "timing": return state.profile.shortTiming === "newYear" ? "Looking to avoid the holiday craziness—smart!" : state.profile.shortTiming ? "Gotcha! That move is coming up super quick." : /\bsummer\b/.test(text) && /^(buying|relocating)$/.test(state.intent) ? "" : /\b(spring|summer|fall|winter|next year)\b/.test(text) ? "Totally get it." : "Great, that timing makes sense.";
      case "priorities": if (/\bschools?\b/i.test(answer)) return "Awesome! We get a lot of families moving here for those Wake County schools!"; return state.profile.familyNearby && !state.profile.familyArea ? "Oh, that's wonderful!" : state.profile.commuteMentioned ? "Got it." : state.profile.priorityPrice ? "Awesome." : state.profile.prioritySingle ? "Got it." : "Makes perfect sense.";
      case "priorityMore": if (/\bschools?\b/i.test(answer)) return "Awesome! We get a lot of families moving here for those Wake County schools!"; return state.profile.commuteMentioned ? "Got it." : state.profile.priorityPrice ? "Awesome." : "Makes perfect sense.";
      case "commuteDestination": return "Got it.";
      case "commuteRange": return "That makes sense.";
      case "priorityBudget": return state.profile.priorityBudgetAmount >= 500000 ? "Okay, great. Sounds like we've got a lot to work with for our market." : "👍";
      case "priorityFinancing": return engine.financingType(answer) ? "Great!" : "";
      case "areas": return state.profile.areasMentionFamilyArea ? "That makes sense." : state.profile.areasNeedFollowup ?
        (state.profile.areasPlural ? "Awesome, those are great areas!" : "Awesome, that's a great area!") : "That makes sense!";
      case "areasReason": return "Makes perfect sense!";
      case "home": return state.profile.budgetKnown ? "That gives me a good picture!" : "Got it.";
      case "homeMore": return "Got it.";
      case "nextHome": return "That gives me a better picture.";
      case "budget": return state.profile.budgetKnown ? (priceAmount(engine.extractBudget(answer)) >= 500000 ? "Okay, great. Sounds like we've got a lot to work with for our market." : "👍") : "That's totally fine. We can connect you with a lender to get a clearer picture of your buying power.";
      case "financing": return engine.financingType(answer) ? "Great!" : "";
      case "preapproval": return state.profile.preApproved ? "" : "Got it, noted.";
      default: return "Got it.";
    }
  }
  function routeRentalPlan(value) {
    var investmentRequest=(config.investingKeywords||[]).some(function(term){return new RegExp('\\b'+String(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(engine.normalizeInput(value));});
    if (state.booking || state.intent === "investing" || investmentRequest) return false;
    var p=state.profile, text=String(value), plan=engine.transactionPlan(text);
    var origin=p.facts && p.facts.location;
    if(origin){p.location=origin.type;p.origin=origin.place||'';p.originCode=origin.stateCode||'';p.originCity=origin.city||'';}
    var rentalQuestion=/\b(?:work with|help|assist|do|handle|offer|find)\b.{0,35}\b(?:renters|rentals?|renting|rental search)\b/i.test(text) && engine.asksQuestion(text);
    var futureRent=asksToRent(text) || engine.rentalOnly(text) || plan.sellThenRent || /\b(?:will|going to|plan to|planning to)\s+(?:only )?(?:be )?rent(?:ing)?\b/i.test(text);
    var localSale=(state.intent==='selling'||plan.id==='selling') && (p.location==='local'||(config.localAreas||[]).some(function(area){return String(p.facts && p.facts.currentHome||'').toLowerCase()===area.toLowerCase();}));
    if(localSale && !state.combined && !plan.combined && (futureRent||p.sellThenRent||p.facts && p.facts.sellThenRent))return false;
    if(p.pendingRentalSale){
      if(/\b(?:sell|selling|list|listing)\b/i.test(text)&&!engine.transactionPlan(text).keepHome){p.originSale=true;p.facts.originHousing='Home to sell';}
      else if(/\b(?:no|keep|keeping|not selling)\b/i.test(text)){p.originSale=false;p.facts.willSell='No';}
      else {message("Will you be selling your current home, or keeping it?",false);return true;}
      p.pendingRentalSale=false;p.rentalSaleAnswered=true;
      if(routeSellerReferral(text))return true;explainRentalOnly();return true;
    }
    if (p.rentalOnly && plan.explicit && plan.id==='buying' && !futureRent) {
      p.rentalOnly=false;p.informationOnly=false;p.rentalPlanConfirmed=false;p.pendingRentalPlan=false;
      p.rentalHorizon='';persist();
    }
    if (!p.pendingRentalPlan && !futureRent && !rentalQuestion) return false;
    if (futureRent) p.rentalPlanConfirmed=true;
    if (plan.id==='buying' && !futureRent && !rentalQuestion) {p.pendingRentalPlan=false;return false;}
    var duration=text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|a few|few)(?:[-– ]+(?:to[- ]+)?(\d+|three|six|twelve))?\s*(?:[- ]?(?:plus|or more)|\+)?[- ]*(months?|mos|years?)\b/i);
    var numbers={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,'a few':3,few:3};
    var months=duration ? (numbers[(duration[2]||duration[1]).toLowerCase()] || Number(duration[2]||duration[1])) * (/year/i.test(duration[3])?12:1) : 0;
    var horizon=months && months<=3 ? 'short' : months>=6 || /\b(?:annual lease|year[- ]long|a year|at least a year)\b/i.test(text) ? 'long' : '';
    if (!horizon) {
      if (!p.pendingRentalPlan && rentalQuestion && !(p.facts && p.facts.transactionGoal==='buying')) message(config.rentalConversation.services,false);
      message(p.pendingRentalPlan ? config.rentalConversation.clarify : config.rentalConversation.qualifier,false);
      p.pendingRentalPlan=true;
      p.awaitingFirstName=false;
      delete p.pendingIntroReply;
      persist(); return true;
    }
    p.pendingRentalPlan=false;
    p.rentalHorizon=horizon;
    if (horizon==='short') {
      p.outOfStateReferral=false;p.rentalOnly=false;p.informationOnly=false;p.awaitingFirstName=false;
      state.intent='buying';p.transactionGoal='buying';state.combined=false;
      p.facts=p.facts||{};p.facts.transactionGoal='buying';p.facts.saleOnly=false;
      message(config.rentalConversation.short,false);
      persist();startBooking();return true;
    }
    if (routeSellerReferral(text)) return true;
    if(p.location==='out' && /own/i.test(p.facts && p.facts.originHousing || '') && !p.rentalSaleAnswered && p.facts.willSell!=='No') {
      p.pendingRentalSale=true;message("Will you be selling your current home before moving, or keeping it?",false);persist();return true;
    }
    explainRentalOnly();return true;
  }
  function routeSellerReferral(value) {
    if (state.booking || state.intent === "investing" || state.profile.rentalHorizon !== "long") return false;
    var p = state.profile, facts = p.facts || {}, plan = engine.transactionPlan(value);
    if (plan.combined || plan.id === "buying") { p.outOfStateReferral = false; return false; }
    var outside = facts.location ? facts.location.type === "out" : p.location === "out";
    if (facts.currentHome && (config.localAreas || []).some(function(area){return area.toLowerCase() === facts.currentHome.toLowerCase();})) return false;
    if (/\b(?:nothing|no (?:house|home|property)) to sell\b/i.test(facts.originHousing || value)) return false;
    var sale = p.originSale || p.sellThenRent || facts.sellThenRent || /\bsell|selling|listing\b/i.test(facts.originHousing || "") || state.intent === "selling";
    var renting = p.rentalPlanConfirmed || p.sellThenRent || facts.sellThenRent || plan.sellThenRent || engine.rentalOnly(value) || asksToRent(value) || /\b(?:will|going to) (?:be )?renting\b/i.test(value);
    if (!outside || !sale || !renting || p.noScheduling || p.noContact || p.researchOnly) return false;
    applyKnownFacts();
    p.outOfStateReferral = true;
    p.rentalOnly = false;
    p.informationOnly = false;
    p.awaitingFirstName = false;
    p.pendingRentalPlan = false;
    delete p.pendingIntroReply;
    state.intent = "selling";
    p.transactionGoal = "selling";
    state.combined = false;
    state.question = -1;
    var market = (p.originCity || "").replace(/\b[a-z]/g,function(letter){return letter.toUpperCase();}) || originLabel() || "your market";
    message(config.sellerReferral.intro.replace("{market}", market), false, {link:{label:config.sellerReferral.resourceLabel,href:config.sellerReferral.resourceUrl}});
    message(config.sellerReferral.invitation, false);
    persist();
    startBooking("phone call");
    return true;
  }
  function explainRentalOnly() {
    state.intent = null;
    state.question = -1;
    state.profile.pendingRentalPlan = false;
    state.profile.rentalOnly = true;
    finishConversation();
    message(config.rentalConversation.services, false);
    link("Explore Raleigh guides", "/learning-center/");
  }
  function asksToRent(value) {
    return /\bhelp\s+(?:(?:me|us|someone)\s+)?(?:to\s+)?rent\b|\b(?:looking|want|need|plan|planning|going|hoping|thinking|interested)\s+to\s+rent\b|\b(?:mov\w*|relocat\w*|coming|headed)\b.{0,80}\bto rent\b|\brent(?:ing)?\s+(?:first|for now|instead|now)\b|\b(?:looking|searching)\s+for\s+(?:a\s+)?rental\b/i.test(value);
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
    return [/\b(?:bed|bedroom)/, /\b(?:bath|bathroom)/, /\b(?:sq\.?\s?ft|square feet|square footage)/, /\b(?:yard|backyard|lot)/, /\b(?:ranch|one.story|single.story|two.story|one.level|layout|townhouse|condo)/, /\b(?:step.free|wheelchair|accessible)/, /\b(?:garage|pool|office|basement)/].filter(function (pattern) { return pattern.test(text); }).length;
  }
  function captureVisitorContext(value) {
    var text = String(value || "");
    var current = state.intent && (activeQuestions().find(function(q){return q.key===state.profile.currentQuestionKey;}) || activeQuestions()[state.question]);
    var detected = engine.detectIntent(text, config);
    if(/\b(?:book|schedule|arrange|consult(?:ation)?|appointment|meet|call)\b/i.test(text) && !/\b(?:number|direct line|phone number)\b/i.test(text)){
      var host=requestedPerson(text);if(host)state.profile.requestedHost=host;
      if(host || /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|morning|afternoon|evening)\b/i.test(text)) state.profile.bookingPreference=bookingPreferenceFromText(text,state.profile.bookingPreference);
    }
    var addingPurchase=state.intent==='selling' && detected && detected.id==='buying' && /\b(?:too|also|as well)\b/i.test(text) && !/\b(?:not selling|no longer sell|instead of selling)\b/i.test(text);
    var facts = engine.extractFacts(text, config, state.intent || detected && detected.id, addingPurchase ? null : current && current.key);
    if (addingPurchase) delete facts.currentHome;
    if (state.intent==='selling' && facts.transactionGoal==='buying' && /\b(?:too|also|as well)\b/i.test(text) && !/\b(?:not selling|no longer sell|instead of selling)\b/i.test(text)) {
      facts.transactionGoal='selling';facts.combined=true;facts.saleOnly=false;state.combined=true;
    }
    if (facts.home) { state.profile.homeDetailEvidence = ((state.profile.homeDetailEvidence || "") + " " + text).trim().slice(-1600); facts.home = engine.mergeHome((state.profile.facts || {}).home, facts.home); }
    state.profile.facts = Object.assign({}, state.profile.facts || {}, facts);
    if (facts.budget) state.profile.priorityBudgetAmount = priceAmount(facts.budget);
    if (facts.sellThenRent !== undefined) state.profile.sellThenRent = facts.sellThenRent;
    if (engine.isSensitiveFamilyReason(text) || /\b(?:divorce|separat(?:ion|ing|ed)|bereavement|death|died|illness|terminal)\b/i.test(text)) state.profile.sensitiveMove = true;
    if (engine.declinesScheduling(text)) state.profile.noScheduling = true;
    if (engine.declinesContact(text)) { state.profile.noContact = true; state.profile.skipName = true; }
    if (engine.researchOnly(text)) { state.profile.researchOnly = true; state.profile.noScheduling = true; state.profile.skipName = true; }
    if (/\b(?:don't|do not) ask (?:me )?for my name|\b(?:stay|remain) anonymous\b/i.test(text)) state.profile.skipName = true;
    var familyPlace = text.match(new RegExp('\\b(?:family|relatives|parents|friends|mother|father)\\b.{0,60}?\\b(?:in|near)\\s+(' + (config.localAreas || ['Raleigh', 'Cary', 'Durham']).join('|') + ')\\b', 'i'));
    if ((familyPlace || /\b(?:near|closer to|close to|be with)\s+(?:(?:my|our)\s+)?(?:family|relatives|parents|friends|mother|father)\b/i.test(text)) && !/\bno (?:family|friends)\b/i.test(text)) {
      state.profile.facts.hasFamilyNearby = true;
      if (familyPlace) { state.profile.facts.familyArea = familyPlace[1]; state.profile.facts.familyNearby = familyPlace[1]; }
    }
    if (/\b(?:mornings?|afternoons?|evenings?|weekends?|weekdays?)\b/i.test(text)) state.profile.bookingPreference = bookingPreferenceFromText(text, state.profile.bookingPreference);
    if (/\b(?:work(?:ing)? remotely|remote (?:job|work|position)|work(?:ing)? from home|fully remote|(?:am|are|'m|'re) (?:both )?remote|wfh)\b/i.test(text)) state.profile.facts.remoteWork = true;
    if (/\b(?:retired|retiring|in retirement)\b/i.test(text)) state.profile.facts.retired = true;
    if (/\b(?:no kids|no children|don't have (?:any )?(?:kids|children)|just me|single person|single guy|single woman)\b/i.test(text)) state.profile.facts.noChildren = true;
    else if (/\b(?:have kids|have children|our kids|our children)\b/i.test(text)) state.profile.facts.noChildren = false;
  }
  function knownAnswer(key) {
    var facts = state.profile.facts || {};
    if (key === 'timing' && state.profile.awaitingTimelineYear) return false;
    if (key === 'home' && facts.home && homeDetailCount(facts.home) < 2 && !facts.homeAnswered) return false;
    if (key==='priorityBudget') return !!facts.budget;
    if (key==='priorityFinancing') return !!facts.financing;
    if (key==='nextHome') return !!facts.home && homeDetailCount(state.profile.homeDetailEvidence || facts.nextHome || facts.home)>=2;
    if (key==='familyNearby' || key==='priorityFamilyArea') return !!facts.familyArea || facts.familyNearbyAnswered===true || facts.hasFamilyNearby===false;
    if (key==='preapproval') return !!facts.preapproval || state.profile.preApproved===true || state.profile.preapprovalAsked===true;
    if (key==='moveGoal') return !!facts.transactionGoal;
    return !!facts[key];
  }
  function applyKnownFacts() {
    var p = state.profile, facts = p.facts || {};
    if (facts.investmentSale) p.investmentSale = true;
    ['remoteWork', 'retired', 'noChildren'].forEach(function (key) { if (facts[key] !== undefined) p[key] = facts[key]; });
    if (facts.hasFamilyNearby !== undefined) p.familyNearby = facts.hasFamilyNearby;
    if (facts.saleOnly !== undefined) p.saleOnly = facts.saleOnly;
    if (facts.transactionGoal === 'buying' || facts.combined) p.saleOnly = false;
    if (facts.transactionGoal) p.transactionGoal = facts.transactionGoal;
    if (facts.bridgeRental) { p.sellThenRent=false; p.bridgeRental=true; }
    if (facts.preapproval) p.preapprovalAsked = true;
    // Repair older saved chats whose family location lived only in the profile.
    if (facts.familyArea === undefined && p.familyAreaAsked && p.familyArea) facts.familyArea=p.familyArea;
    if (facts.familyArea !== undefined) { p.familyArea = facts.familyArea; p.familyAreaAsked = facts.familyAreaAsked===true || !!facts.familyArea; }
    if (facts.location && typeof facts.location === 'object') {
      p.location = facts.location.type; p.origin = facts.location.place || '';
      p.originCode = facts.location.stateCode || ''; p.originCity = facts.location.city || '';
    }
    if (facts.budget) { facts.budget=engine.extractBudget(facts.budget)||facts.budget; p.budgetKnown = priceAmount(facts.budget) > 0; p.budgetAsked = true; p.priorityBudgetAmount = priceAmount(facts.budget); }
    if (facts.financing) { facts.financing=engine.financingType(facts.financing)||facts.financing; p.financingKnown = true; p.usingFinancing = facts.financing==='Financing'; }
    if (facts.timing) { p.targetTiming = facts.timing; p.shortTiming = state.intent === 'investing' ? '' : engine.classifyMoveTiming(facts.timing, new Date()); }
    if (facts.home) { p.homeDetailsGiven = true; p.homeLastAnswer = p.homeDetailEvidence || facts.home; p.homeSingle = !facts.homeMoreAnswered && homeDetailCount(p.homeLastAnswer) <= 2; }
    if (facts.commuteDestination) { p.commuteMentioned = true; p.commuteDestinationKnown = true; p.commuteDestination = facts.commuteDestination; }
    if (facts.commuteRange) { p.commuteMentioned = true; p.commuteRangeKnown = true; p.commuteComfort = facts.commuteRange; }
    if (facts.jobLocation && p.commuteMentioned && !p.remoteWork && !p.retired) { p.commuteDestinationKnown = true; p.commuteDestination = facts.jobLocation; }
    if (facts.whyRaleigh && /\bjob|work|training\b/i.test(facts.whyRaleigh)) p.newJob = true;
    if (facts.areas) {
      p.areasNeedFollowup = !p.areasUnknown && !facts.areasReason && !/\b(?:because|since|near|close to|for its|commute|schools?|family)\b/i.test(facts.areas);
      p.areasMentionFamilyArea = !!p.familyArea && facts.areas.toLowerCase().indexOf(p.familyArea.toLowerCase()) !== -1;
    }
    if (facts.tenure) p.tenure = engine.detectTenure(facts.tenure) || facts.tenure;
    if (facts.originHousing) { p.originRenting = /rent|lease/i.test(facts.originHousing); p.originSale = /sell|own/i.test(facts.originHousing) && !/no.*sell|not.*sell|nothing to sell/i.test(facts.originHousing); }
  }
  function markPreapproval(value) {
    var text = String(value || "");
    if ((/\b(?:pre[- ]?approv(?:ed|al)|approval letter|approved (?:by|with) (?:a |my |our )?(?:lender|bank))\b/i.test(text) || /\b(?:approval already|have approval)\b/i.test(text) && state.profile.facts && state.profile.facts.financing==='Financing') &&
        !/\b(?:not|never|haven't|have not|need to|looking to|want to|trying to)\s+(?:been\s+|get\s+|be\s+)?pre[- ]?approv/i.test(text)) {
      state.profile.preApproved = true;
      state.profile.usingFinancing = true;
      state.profile.financingKnown = true;
    }
  }
  function acceptAnswer(answer) {
    var question = activeQuestions().find(function(q){return q.key===state.profile.currentQuestionKey;}) || activeQuestions()[state.question];
    if(question && /^(?:budget|priorityBudget)$/.test(question.key) && /^\s*\d[\d,]{4,8}\s*$/.test(answer) && priceAmount(answer)>=10000 && priceAmount(answer)<=50000000) answer='$'+answer.trim();
    if (question && question.key === "timing" && state.intent !== "investing") {
      var uncertainTiming = /\b(?:not sure|unsure|undecided|don['’]?t know|no idea|can['’]?t say|haven['’]?t decided|just (?:started|starting|began|researching)|no (?:set )?(?:timeline|timeframe|date))\b/i.test(answer);
      if (uncertainTiming && !state.profile.timelineYearAsked) {
        state.profile.timelineYearAsked = true;
        state.profile.awaitingTimelineYear = true;
        state.profile.facts = state.profile.facts || {};
        delete state.profile.facts.timing;
        state.profile.targetTiming = "";
        state.profile.shortTiming = "";
        persist();
        message(config.conversationResponses.uncertainTimeline, false);
        return;
      }
      state.profile.awaitingTimelineYear = false;
      state.profile.researchTimeline = uncertainTiming || /\b(?:far (?:out|off|away)|couple (?:of )?years|few years|several years|no rush|eventually|someday|some day)\b/i.test(answer) || /\b(?:[2-9]|two|three|four|five)\s*(?:\+|or more)?\s*years?\b/i.test(answer);
    }
    if (question && question.key === 'salePriority' && !/\b(?:sale|sell|selling|both|exchange|invest|investment|buy|purchase|next)\b/i.test(answer)) {
      scheduleClarification(question.text); return;
    }
    if (question && /^(firstTime|sellingExperience|experience)$/.test(question.key) &&
        !/\b(?:yes|no|first|never|before|experience|experienced|new to|own|owned|invested|rentals?|years?|\d+)\b/i.test(answer)) {
      scheduleClarification("Just to clarify: " + question.text); return;
    }
    var unclear=question && engine.isUnclearAnswer(answer,question.key);
    var unrelatedHome=question && /^(?:home|homeMore|nextHome)$/.test(question.key) && !homeDetailCount(answer) && !/\b(?:home|house|room|space|layout|kitchen|storage|closet|porch|patio|deck|garden|land|acre|lot|fence|floor|story|storey|stairs|elevator|light|bright|modern|maintenance|accessible|accessibility|wheelchair|privacy|quiet|new construction|open plan|open concept|townhome|condo|brick|master|primary|basement|workshop|view|waterfront|ranch|pool|price|budget|afford|walkable|nothing else|that's all|no more|not sure|haven't decided)\w*\b/i.test(answer);
    if(unclear || unrelatedHome){
      var key=question.key, attempts=state.profile.unclearAnswers=state.profile.unclearAnswers||{};
      attempts[key]=(attempts[key]||0)+1;
      if(attempts[key]>=2)message("I'm still not quite following. You can call or text the team at 919-737-7896 if that's easier. " + question.text,false);
      else scheduleClarification("Sorry, I don't quite understand. " + question.text);
      return;
    }
    if(question && state.profile.unclearAnswers)delete state.profile.unclearAnswers[question.key];
    if (question && /^(?:financing|priorityFinancing)$/.test(question.key) && !engine.financingType(answer) && !/\b(?:not sure|unsure|don't know|do not know|no idea|haven't decided|undecided)\b/i.test(answer)) { scheduleClarification("Would you use financing or buy with cash? It's okay if you're not sure yet."); return; }
    if (question && /^(?:budget|priorityBudget)$/.test(question.key) && !engine.extractBudget(answer) && !/\b(?:not sure|unsure|don't know|do not know|no idea|undecided|need a lender)\b/i.test(answer)) { scheduleClarification("What home price would feel comfortable? It's okay if you're not sure yet."); return; }
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
        message(config.rentalConversation.services, false);
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
        message(config.rentalConversation.services, false);
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
      state.profile = Object.assign({}, state.profile, { firstName: state.profile.firstName || "", introAsked: !!state.profile.introAsked });
      message("Got it. Let's plan your sale and next purchase together.", false);
      askQuestion();
      return;
    }
    if (question && question.key === "whyRaleigh") {
      var mentionedOrigin = engine.detectLocation(answer, config);
      if (mentionedOrigin && mentionedOrigin.type === "out" && mentionedOrigin.place) {
        mentionedOrigin = engine.resolveOrigin(mentionedOrigin, config);
        state.profile.origin = mentionedOrigin.place || "";
        state.profile.originCode = mentionedOrigin.stateCode || "";
        state.profile.originCity = mentionedOrigin.city || "";
      }
      state.profile.familyNearby = /\b(family|relatives|friends|parents|siblings|folks|mom|mother|dad|father)\b/i.test(answer);
      state.profile.sensitiveFamilyReason = engine.isSensitiveFamilyReason(answer);
      state.profile.nearbyPerson = /\bfriends\b/i.test(answer) && !/\b(family|relatives|parents|siblings|folks|mom|mother|dad|father)\b/i.test(answer) ? "friends" : "family";
      state.profile.newJob = state.intent === "relocating" && /\b(new job|job offer|for (?:a|my) job|for work|work transfer|transferred|new position|starting (?:a|my) job)\b/i.test(answer);
      state.profile.commuteMentioned = /\bcommut(?:e|ing)\b/i.test(answer) && !state.profile.remoteWork && !state.profile.retired;
      state.profile.prioritiesKnown = false;
    }
    if (question && question.key === "jobLocation" && state.profile.commuteMentioned && !state.profile.remoteWork) state.profile.commuteDestinationKnown = true;
    if (question && (question.key === "familyNearby" || question.key === "priorityFamilyArea")) {
      var familyPlace = answer.trim().replace(/[.!?]+$/, "");
      state.profile.familyArea = /^(?:yes|no|yeah|yep|here|not sure|unsure|no idea|don't know|i don't know|i am not sure|somewhere in (?:the )?triangle)$/i.test(familyPlace) ? "" : familyPlace.slice(0, 60);
      state.profile.familyAreaAsked = true;
    }
    if (question && (question.key === "priorities" || question.key === "priorityMore")) {
      if (/\b(family|relatives|parents|siblings|friends)\b/i.test(answer.replace(/family[- ]friendly/ig, "")) && !/\b(?:no|not|don't have|do not have)\s+(?:any )?(?:family|relatives|parents|siblings|friends)\b/i.test(answer)) {
        state.profile.familyNearby = true;
        state.profile.nearbyPerson = /\bfriends\b/i.test(answer) && !/\b(family|relatives|parents|siblings)\b/i.test(answer) ? "friends" : "family";
      }
      state.profile.priorityAnswered = true;
      state.profile.priorityPrice = mentionsPrice(answer);
      if (/\bcommut(?:e|ing)\b/i.test(answer) && !state.profile.remoteWork && !state.profile.retired) state.profile.commuteMentioned = true;
      state.profile.prioritySingle = question.key === "priorities" && !state.profile.priorityPrice && !state.profile.commuteMentioned && (engine.uncertainArea(answer)||!/,|;|\band\b|\bplus\b|&/i.test(answer));
      if (homeDetailCount(answer)) state.profile.homeDetailsGiven = true;
    }
    if (question && question.key === "commuteDestination") {
      state.profile.commuteDestinationKnown = true;
      state.profile.commuteDestination = /\b(?:rtp|research triangle park)\b/i.test(answer) ? "Research Triangle Park (RTP)" : answer.slice(0, 120);
    }
    if (question && question.key === "commuteRange") {
      state.profile.commuteRangeKnown = true;
      state.profile.commuteComfort = answer.slice(0, 120);
    }
    if (question && question.key === "priorityBudget") {
      state.profile.priorityBudgetAmount = priceAmount(engine.extractBudget(answer));
      state.profile.budgetAsked = true;
      state.profile.budgetKnown = state.profile.priorityBudgetAmount > 0;
    }
    if (question && (question.key === "priorityFinancing" || question.key === "financing")) {
      state.profile.financingKnown = true;
      state.profile.usingFinancing = engine.financingType(answer)==='Financing';
      if (!engine.financingType(answer)) {
        message(config.conversationResponses.uncertainFunding, false);
        state.profile.justDiscussedUncertainFunding = true;
      }
    }
    if (question && question.key === "preapproval") {
      state.profile.preapprovalAsked = true;
      state.profile.preApproved = /\b(?:yes|already|pre[- ]?approv(?:ed|al))\b/i.test(answer) && !/\b(?:not|no|haven't|have not)\b/i.test(answer);
    }
    offerPreapprovalUpload();
    if (question && question.key === "areas" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.areasUnknown = /\b(?:no (?:specific |particular )?area|not sure|don't know|haven't decided|open to|flexible|just (?:starting|researching))\b/i.test(answer);
      state.profile.rentalClarificationNeeded = state.intent === "relocating" && /\b(rent|renting|lease)\b/i.test(answer);
      state.profile.areasPlural = /,|\band\b|\bor\b|\//i.test(answer);
      state.profile.areasNeedFollowup = !state.profile.areasUnknown && !/\b(?:because|since|near|close to|closer to|for the|for its|for their|due to|like the|love the|drawn to|appeals? to|commute|schools?|walkab|yard|family)\b/i.test(answer);
      state.profile.areasMentionFamilyArea = !!state.profile.familyArea && answer.toLowerCase().indexOf(state.profile.familyArea.toLowerCase()) !== -1;
    }
    if (question && question.key === "home" && /^(buying|relocating)$/.test(state.intent)) {
      state.profile.homeLastAnswer = answer.slice(0, 200);
      state.profile.budgetKnown = state.profile.budgetKnown || /\$\s?\d{3,7}|\b\d{3,4}\s?k\b|\b\d{6,7}\b/i.test(answer) && !/\b(?:not sure|don't know|unsure)\b/i.test(answer);
      state.profile.homeSingle = homeDetailCount(state.profile.homeDetailEvidence || state.profile.facts.home || answer) <= 2;
    }
    if (question && question.key === "homeMore") state.profile.homeSingle = false;
    if (question && question.key === "budget") {
      state.profile.budgetAsked = true;
      state.profile.budgetKnown = !/\b(?:not sure|don't know|do not know|unsure|no idea|haven't decided|need a lender)\b/i.test(answer);
    }
    if (question && question.key === "timing") {
      state.profile.targetTiming = answer;
      state.profile.shortTiming = state.intent === "investing" ? "" : engine.classifyMoveTiming(answer, new Date());
    }
    if (question && question.key !== "location" && question.key !== "tenure" && question.key !== "originHousing" && question.key !== "rentalPlan") {
      acknowledgement = answerAcknowledgement(question, answer);
    }
    state.answers.push(redact(answer));
    state.profile.facts = state.profile.facts || {};
    if (question) {
      var canonicalKey = question.key==='priorityBudget'?'budget':question.key==='priorityFinancing'?'financing':question.key;
      var extracted = engine.extractFacts(answer, config, state.intent, question.key);
      var canonical = extracted[canonicalKey];
      if (canonicalKey==='location') canonical = {type:state.profile.location,place:state.profile.origin,stateCode:state.profile.originCode,city:state.profile.originCity};
      if (/^(?:home|homeMore|nextHome)$/.test(canonicalKey)) {
        var priorHome = state.profile.facts.home || '';
        var extraHome = extracted.home || (/\b(?:nothing else|that covers|that's all|not sure|no more)\b/i.test(answer) ? '' : redact(answer));
        state.profile.facts.home = engine.mergeHome(priorHome, extraHome);
        state.profile.facts.homeAnswered = true;
        if (canonicalKey==='homeMore' || homeDetailCount(state.profile.homeDetailEvidence || state.profile.facts.home) > 2) state.profile.facts.homeMoreAnswered=true;
        if (canonicalKey==='home') canonical=state.profile.facts.home || 'Flexible';
      }
      if (canonicalKey==='familyNearby' || canonicalKey==='priorityFamilyArea') {
        state.profile.facts.familyArea=state.profile.familyArea;
        state.profile.facts.familyAreaAsked=true;
        state.profile.facts.familyNearbyAnswered=true;
      }
      if (canonicalKey==='budget') canonical = engine.extractBudget(answer) || 'Not sure';
      if (canonicalKey==='commuteDestination') canonical=state.profile.commuteDestination;
      if (canonicalKey==='financing') canonical = engine.financingType(answer) || 'Not sure';
      state.profile.facts[canonicalKey] = canonical !== undefined ? canonical : redact(answer);
    }
    applyKnownFacts();
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
    if (state.profile.noContact) { requestContactPermission('contact'); return; }
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
      input.disabled = state.ended;
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
    return /^(?:i (?:have|had|got) (?:a |one |another |quick )?question|can i ask (?:you )?(?:a |one )?question|can i ask you something|can i ask (?:one |a |a quick )?thing|ask a question|quick question|one question|question for you)\s*[.!?]*$/i.test(value);
  }
  function requestedPerson(value) {
    var named=String(value).match(/\b(?:recommended|prefer|with|instead of)\s+(?:a call with\s+)?(Benjamin|Ben|Ricardo)\b/i);
    if(named)return /^ricardo$/i.test(named[1])?'Ricardo':'Benjamin';
    if (/\b(?:benjamin|ben)\b/i.test(value) && !/\bricardo\b/i.test(value)) return "Benjamin";
    if (/\bricardo\b/i.test(value) && !/\b(?:benjamin|ben)\b/i.test(value)) return "Ricardo";
    return "";
  }
  function asksForBenjaminNumber(value) {
    return /\bcan (?:i|we) (?:call|text) you\b|\b(?:what|which)\s+(?:phone\s+)?number\b.{0,40}\b(?:call|text|reach)\b|\b(?:team|benjamin|ben)\b.{0,70}\b(?:number|phone|call|text|reach)\b|\b(?:number|phone|call|text|reach)\b.{0,70}\b(?:team|benjamin|ben)\b/i.test(value);
  }
  function asksForTeamMember(value) {
    if(/^(?:i|we) (?:really )?(?:need|want|would like) (?:a |an? )?(?:real )?(?:human|person|agent|realtor)\b/i.test(value))return true;
    return /^(?:human|a human|real person|talk to somebody|speak to somebody)\s*[.!?]*$/i.test(value) ||
      /\b(?:speak|talk|connect|reach)\s+(?:me\s+)?(?:with|to)\s+(?:an? |the )?(?:real )?(?:team(?: member)?|person|human|(?:real estate )?agent|realtor|representative|someone|somebody|benjamin|ben|ricardo)\b/i.test(value) ||
      /\b(?:get|put)\s+me\s+(?:in touch|connected)\s+with\s+(?:a |the )?(?:team|person|human|agent|someone|somebody|benjamin|ben|ricardo)\b/i.test(value);
  }
  function asksToMeetNamedHost(value) {
    return !!requestedPerson(value) && /\b(?:book|schedule|appointment|meeting|meet|call|time|slot)\b/i.test(value);
  }
  function resumeAfterQuestion() {
    if(state.profile.awaitingFirstName){
      message("May I have your first name? You can also say no thanks.",false);
    } else if (state.booking) {
      var booking = state.booking;
      if (booking.step === "choose" && booking.slots.length) {
        message("Would " + booking.slots.map(function (slot) { return bookingLabel(slot.start); }).join(" or ") + " work for an introduction call, or would another time be better?", false);
      } else if (booking.step === "format") message("Would you prefer a video call, or a phone call? You can also send your email to continue with video.", false);
      else if (booking.step === "email") message(config.bookingEmailPrompt, false);
      else if (booking.step === "phone") message(config.bookingPhonePrompt, false);
      else if (booking.step === "name") message(config.bookingNamePrompt, false);
      else if (booking.step === "purpose") message("Will this call be about buying, selling, or both?",false);
      else if (booking.step === "notes") message("Anything you'd like us to know before the call? You can type skip.", false);
      else message("I'm still checking the calendar. One moment, please.", false);
    } else if (state.contact) {
      var item = config.contactQuestions[state.contact.step];
      if (item) message(item.prompt, false);
      else message(config.contactConsentPrompt, false);
    } else if (state.intent && state.question >= 0 && state.question < activeQuestions().length) askQuestion();
    else if(state.profile.awaitingVisitReason)message("What has you looking at our website today?",false);
    else if(state.profile.informationOnly||state.profile.noScheduling)message("What would you like to know about Raleigh?",false);
    else message(config.welcome, false);
  }
  function answerSideQuestion(value, faq) {
    var humanRequest = asksForBenjaminNumber(value) || asksForTeamMember(value);
    var person = humanRequest ? requestedPerson(value) : "";
    var changeHost=!!person && (!state.booking || asksForTeamMember(value) || /\b(?:meet|book|schedule|prefer|switch|instead)\b/i.test(value));
    if (changeHost) { state.profile.requestedHost = person; persist(); }
    if (person === "Benjamin") message("Benjamin's direct call and text line is " + config.benjaminDirectPhone + ". You can call or text him anytime.", false);
    else if (person === "Ricardo") message("You can reach Ricardo through the Living in Raleigh team line at 919-737-7896. You can call or text us there.", false);
    else if (humanRequest) message("Absolutely. You can call or text the Living in Raleigh team at 919-737-7896.", false);
    else if (informationalGuidance(value)) message(informationalGuidance(value), false);
    else if (faq) message(faq.answer, false);
    else message(config.unknownQuestion || "That's a great question for the team to cover on your call.", false);
    if (humanRequest && (state.profile.noContact || state.profile.noScheduling || state.profile.informationOnly)) return;
    if (humanRequest) {
      if (state.booking && changeHost && state.booking.preference.host !== person) {
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
  function offerBrowsingHelp() {
    state.profile.awaitingVisitReason = false;
    message("Even if you're just exploring, this is the #1 spot for resources on life in Raleigh. I'm happy to answer any questions you have.", false);
    if (state.profile.firstName) { message("What would you like to know about Raleigh?", false); return; }
    state.profile.introAsked = true;
    state.profile.awaitingFirstName = true;
    state.profile.browsingIntro = true;
    persist();
    message("😊 I'm Sam. May I have your first name so I can personalize things for you?", false);
  }
  function receiveText(text) {
    var value=String(text).trim();
    if(!value||state.submitting||state.ended)return;
    if(!understanding){handleText(value);markLatestUserRead();return;}
    var generation=incomingGeneration,sequence=++incomingSequence,receivedAt=Date.now(),history=state.history.slice(-4);
    lastUserSentAt=receivedAt;cancelClarification();interruptBotQueue();
    var privateField=!!state.contact || !!(state.booking && !/^(?:choose|loading|checking)$/.test(state.booking.step));
    message(value,true,{remember:!privateField});sound();
    incomingQueue=incomingQueue.catch(function(){}).then(async function(){
      if(generation!==incomingGeneration||state.ended)return;
      var context={intent:state.intent,question:state.profile.currentQuestionKey,booking:state.booking&&state.booking.step,contact:!!state.contact,awaitingFirstName:!!state.profile.awaitingFirstName,ended:state.ended,known:state.profile,history:history};
      aiStatus.textContent='Understanding your message…';
      var result=await understanding.interpret(value,context);
      if(generation!==incomingGeneration)return;
      aiStatus.textContent=result.mode==='ai'?'AI interpreted · existing rules handle the reply':result.mode==='fallback'?'AI unavailable · existing bot handling this message':result.reason==='clear_message'?'Existing rules · clear message':'Existing rules · contact, safety or scheduling';
      if(sequence===incomingSequence)markLatestUserRead();
      handleText(value,false,{canonical:result.canonical,kind:result.kind,topic:result.topic,alreadyShown:true,receivedAt:receivedAt});
    });
  }
  function handleText(text, replaying, interpretation) {
    var originalValue = String(text).replace(/[’]/g, "'").trim();
    var value = interpretation && interpretation.canonical || originalValue;
    if (!value || state.submitting || state.ended) return;
    if (!replaying && !state.profile.analyticsConversationStarted) {
      trackConversation('chat_conversation_started');
      state.profile.analyticsConversationStarted = true;
    }
    state.hasUserMessage = true;
    persist();
    if (!replaying) {
      lastUserSentAt = interpretation && interpretation.receivedAt || Date.now();
      cancelClarification();
      interruptBotQueue();
    }
    state.sentMessageSinceOpen = true;
    try { window.sessionStorage.setItem("livrChatQuietUntil", String(Date.now() + 30 * 60 * 1000)); } catch (_) {}
    if (/^(forget|forget me|clear chat|delete chat history)$/i.test(value)) {
      clearConversation();
      message("This browser's chat history is cleared. What would you like to discuss?", false, { remember: false });
      sound();
      return;
    }
    var safety = engine.classifySafety(originalValue, state.previousInput);
    var assistantTopic=engine.assistantTopic(originalValue)||(interpretation&&/^assistant_(?:identity|capabilities|privacy)$/.test(interpretation.topic||'')?interpretation.topic:'');
    if (!assistantTopic && !engine.socialGreeting(originalValue) && (!interpretation || interpretation.kind!=='question') && (!state.booking || state.booking.step === 'choose' || state.booking.step === 'loading')) captureVisitorContext(value);
    state.previousInput = originalValue;
    var strikes = safety ? safetyRecord(safety) : 0;
    if (safety && safety !== "language") {
      if(!interpretation || !interpretation.alreadyShown) message(originalValue, true, { remember: false });
      sound();
      if (strikes >= 2 || safety === "hate" || safety === "threat") {
        state.ended = true;
        finishConversation();
        input.disabled = true;
        sendButton.disabled = true;
        message(config.safetyEnd || "I'm going to end this conversation for now.", false, { remember: false });
      } else if (safety === "discrimination") {
        message("I can't help choose neighborhoods by race, religion, or who lives there. I can help compare housing cost, home types, commute routes, parks, and shopping. Which of those would you like to compare?", false, { remember: false });
      } else if (safety === "gibberish") {
        message("Sorry, I don't quite understand.", false, { remember: false });
        if (state.profile.awaitingFirstName) message("May I have your first name? You can also say no thanks.", false, { remember: false });
        else if (state.intent && state.question >= 0 && state.question < activeQuestions().length) askQuestion();
        else message(config.welcome, false, { remember: false });
      } else message(config.safetyWarning || "Let's keep this focused on your real estate question.", false, { remember: false });
      return;
    }
    var contactCommand = /^(contact|send a message|ask a question|talk to someone|speak to someone|human)$/i.test(value);
    if (!replaying && (!interpretation || !interpretation.alreadyShown)) {
      message(originalValue, true, { remember: !state.contact && !contactCommand });
      sound();
    }
    if (engine.endsConversation(value)) {
      state.booking = null;
      state.contact = null;
      state.intent = null;
      state.question = -1;
      state.profile.awaitingFirstName = false;
      delete state.profile.pendingIntroReply;
      state.profile.browsingEnded = true;
      finishConversation();
      message("Take care! If you have questions later, I'll be here.", false);
      return;
    }
    // Boundaries and changed consent apply before name collection or time parsing.
    // Clearing a draft never cancels an existing Calendar appointment.
    if (engine.cancelsScheduling(value) || engine.declinesScheduling(value) || engine.declinesContact(value)) {
      state.booking = null;
      state.contact = null;
      state.profile.awaitingFirstName = false;
      delete state.profile.pendingIntroReply;
      delete state.profile.pendingContactPermission;
      state.intent = state.intent || (detectIntent(value) || {}).id || null;
      informationalReply(value);
      return;
    }
    // A question is a detour at every stage, including first-name and contact
    // prompts. Carry the model's speech act through instead of discarding it.
    var semanticQuestion=interpretation&&interpretation.kind==='question';
    var questionTopic=semanticQuestion&&interpretation.topic||'';
    var topicMatch=questionTopic.match(/^(faq|info)_(\d+)$/);
    var approvedAnswer=topicMatch&&(topicMatch[1]==='faq'?config.faq:config.informationalAnswers)[Number(topicMatch[2])];
    if(engine.socialGreeting(originalValue)){
      if(!state.profile.introAsked&&!state.intent&&!state.booking&&!state.contact){
        state.profile.introAsked=true;state.profile.awaitingFirstName=true;persist();
      }
      message(config.socialGreetingAnswer,false);
      resumeAfterQuestion();
      return;
    }
    if(assistantTopic){
      message(config.assistantAnswers[assistantTopic],false);
      if(assistantTopic==='assistant_privacy')link('Read our privacy policy','/privacy-policy/');
      resumeAfterQuestion();
      return;
    }
    if (state.booking && !/^(?:choose|loading|checking)$/.test(state.booking.step)) {
      var bookingQuestion = (semanticQuestion||engine.asksQuestion(value)) && state.booking.step !== 'notes';
      if (bookingQuestion) answerSideQuestion(value, approvedAnswer||engine.findFaq(value, config));
      else handleBookingAnswer(value);
      return;
    }
    if(!state.booking && state.profile.currentQuestionKey==='timing' && engine.researchOnly(value) && /\b(?:not sure|unsure|undecided|just researching|just started)\b/i.test(value) && !/\b(?:only|no call|don't|do not)\b/i.test(value)){
      state.profile.researchOnly=false;state.profile.noScheduling=false;state.profile.informationOnly=false;
      acceptAnswer(value);return;
    }
    var budgetQuestion=/^(?:budget|priorityBudget)$/.test(state.profile.currentQuestionKey||'');
    var uncertainBudget=/\b(?:whatever (?:we|i) (?:can )?qualify for|depend(?:s|ing) on (?:the lender|approval|what (?:we|i) qualify)|(?:rather|prefer to|want to) discuss (?:the )?(?:price|budget) (?:on|during) (?:the |our )?call|need to (?:speak|talk) (?:with|to) (?:a |the )?lender)\b/i.test(value);
    if(!state.booking && !state.profile.awaitingFirstName && budgetQuestion && uncertainBudget){
      state.profile.budgetContext=value;acceptAnswer('Not sure yet');return;
    }
    var updatedGoal = state.profile.facts && state.profile.facts.transactionGoal;
    if (updatedGoal && state.intent && state.intent !== 'investing' && updatedGoal !== state.intent &&
        !((state.intent==='relocating') && updatedGoal==='buying')) {
      state.intent = updatedGoal;
      state.combined = !!state.profile.facts.combined;
      state.question = 0;
      state.profile.currentQuestionKey = '';
      state.profile.transactionGoal = updatedGoal;
    }
    if (engine.explicitBooking(value)) {
      state.profile.noScheduling = false;
      state.profile.researchOnly = false;
      state.profile.informationOnly = false;
      state.profile.awaitingFirstName = false;
      delete state.profile.pendingIntroReply;
    }
    if (routeRentalPlan(value)) return;
    if (isQuestionPreamble(value)) {
      state.questionDetour = true;
      message("Absolutely, what's the question that you have?", false);
      return;
    }
    if ((asksForBenjaminNumber(value) || asksForTeamMember(value)) && !engine.explicitBooking(value)) {
      if(/\b(?:phone|telephone)\b/i.test(originalValue)&&!/\b(?:not|no|instead of|rather than)\s+(?:a\s+)?(?:phone|telephone)\b/i.test(originalValue)){
        state.profile.preferredCallType='phone';
        if(state.booking)state.booking.details.callType='phone';
      }
      answerSideQuestion(value, null); return;
    }
    if (/\b(?:calculator|resources?|guides?|learn more|buying page|selling page)\b/i.test(value) &&
        (engine.asksQuestion(value) || /\b(?:give|show|read|point|link|wanted|want)\b/i.test(value))) {
      var resourceIntent = state.intent || (detectIntent(value)||{}).id || (/sell/i.test(value)?'selling':'buying');
      var resourceFlow = config.flows[resourceIntent];
      if (/calculator/i.test(value)) { message('Yes, here is our investment calculator.',false); link('Open the investment calculator','/calculator/'); }
      else if (resourceFlow && resourceFlow.resourceLink) { message('Here are the resources you asked for.',false); link(resourceFlow.resourceLink.label,resourceFlow.resourceLink.href); }
      if (state.intent && !state.profile.informationOnly && !state.profile.noScheduling && !state.booking) askQuestion();
      return;
    }
    if (!state.booking && /\b(?:not|neither) (?:buying|buy) or (?:selling|sell)\b|\b(?:just visiting|enjoying (?:the )?videos|just watching videos)\b/i.test(value) && !engine.rentalOnly(value)) {
      state.intent=null; state.profile.rentalOnly=false;
      offerBrowsingHelp(); return;
    }
    if (engine.researchOnly(value) || state.profile.informationOnly && !engine.explicitBooking(value)) {
      state.intent = state.intent || (detectIntent(value) || {}).id || null;
      informationalReply(value,approvedAnswer);
      return;
    }
    if (!state.booking && engine.rentalOnly(value)) { explainRentalOnly(); return; }
    if (engine.explicitBooking(value) && !state.booking && !state.contact) {
      var bookingIntent = detectIntent(value);
      if (bookingIntent) state.intent = bookingIntent.id;
      state.profile.introAsked = true;
      startBooking(value);
      return;
    }
    if (!state.booking && state.intent === 'selling' && state.profile.sellThenRent && state.combined) {
      state.combined = false;
      state.question = 0;
      askQuestion("Got it—we'll focus on your sale and the transition to renting, without planning a purchase.");
      return;
    }
    var earlyGuidance = (engine.asksQuestion(value) || /\b(?:give me|show me|could you|can you|explain|explanation|help|question|what|how)\b/i.test(value)) && informationalGuidance(value);
    if (earlyGuidance && !approvedAnswer && !state.booking && !engine.explicitBooking(value)) {
      message(earlyGuidance, false);
      if (state.intent && !state.profile.awaitingFirstName) askQuestion();
      return;
    }
    var requestedTime=state.booking&&state.booking.step==='choose'&&(hasBookingPreference(value)||!!requestedClock(value)||/\d|\b(?:mon|tues?|wed|thurs?|fri|sat|sun)\b|\b(?:different|other|alternative|more|another)\b.{0,25}\b(?:times|slots|openings|options)\b|^(?:first|second|one|two)$/i.test(value.trim()));
    var statedGoal=detectIntent(value)&&/^(?:actually\b|i(?:'m| am)?\s+(?:also\s+)?(?:want|need|plan|intend|would like|looking|moving|selling|buying)|we(?:'re| are)?\s+(?:also\s+)?(?:want|need|plan|looking|moving|selling|buying)|(?:can|could|do|would)\s+(?:you|your team)\s+(?:help|assist|work)\b)/i.test(value);
    if(!isQuestionPreamble(value)&&!engine.explicitBooking(value)&&!engine.researchOnly(value)&&!statedGoal&&!requestedTime&&
        (semanticQuestion||!state.intent&&engine.asksQuestion(value))&&
        !asksForBenjaminNumber(value)&&!asksForTeamMember(value)&&!engine.wantsResources(value)&&
        !/\b(?:calculator|give me|show me)\b/i.test(value)&&
        !(state.contact&&state.contact.step<config.contactQuestions.length&&config.contactQuestions[state.contact.step].key==='question')&&
        !(state.booking&&state.booking.step==='notes')){
      var detourFaq=engine.findFaq(value,config);
      var detourGuidance=informationalGuidance(value);
      if(approvedAnswer||detourGuidance||detourFaq){
        message(approvedAnswer?approvedAnswer.answer:detourGuidance||detourFaq.answer,false);
        if(state.profile.awaitingFirstName||state.booking||state.contact||state.intent)resumeAfterQuestion();
        return;
      }
      // A question with no approved answer must not become a name, budget,
      // motivation, or a made-up answer. Offer a person and retain the step.
      message("I don't have a reliable answer to that in chat. You can call or text the team at 919-737-7896, and they'll help you with it.",false);
      if(state.profile.awaitingFirstName||state.booking||state.contact||state.intent)resumeAfterQuestion();
      return;
    }
    if (state.profile.pendingContactPermission && !replaying) {
      var permissionAction = state.profile.pendingContactPermission;
      delete state.profile.pendingContactPermission;
      if (/^(?:yes|yes please|i confirm|i agree|go ahead|you may|that's fine)[.!?]*$/i.test(value)) {
        state.profile.noContact = false;
        persist();
        if (permissionAction === 'booking') startBooking(); else showContact();
        return;
      }
      if (/^(?:no|no thanks|not yet|not now|cancel)[.!?]*$/i.test(value)) {
        message("No problem. We can keep chatting without collecting your details.", false); return;
      }
    }
    if (state.profile.awaitingFirstName && !replaying) {
      state.profile.awaitingFirstName = false;
      if (!engine.declinesName(value)) {
        var firstName = engine.extractFirstName(value);
        if (!firstName) {
          state.profile.awaitingFirstName = true;
          message("I was asking what first name you'd like me to use. You can also say no thanks.", false);
          persist();
          return;
        }
        state.profile.firstName = firstName;
        message("Nice to meet you, " + state.profile.firstName + "!", false);
      } else message("No worries!", false);
      var pendingIntroReply = state.profile.pendingIntroReply;
      delete state.profile.pendingIntroReply;
      if (state.profile.browsingIntro) {
        state.profile.browsingIntro = false;
        persist();
        message("What would you like to know about Raleigh?", false);
        return;
      }
      persist();
      if (pendingIntroReply) handleText(pendingIntroReply, true);
      else if (!state.intent) message("Are you looking to buy or sell real estate in the Raleigh area?", false);
      return;
    }
    if (state.profile.awaitingVisitReason && !replaying) {
      state.profile.awaitingVisitReason = false;
      persist();
      if (!detectIntent(value) && !engine.wantsBooking(value) && !engine.asksQuestion(value)) {
        offerBrowsingHelp();
        return;
      }
    }
    if (!replaying && !state.intent && !state.profile.introAsked && !detectIntent(value) &&
        /\b(?:bored|just browsing|looking around|just exploring|killing time)\b/i.test(value)) {
      offerBrowsingHelp();
      return;
    }
    if (!replaying && !state.profile.introAsked && !state.intent && !state.booking && !state.contact &&
        /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|how(?:'s| is) it going|how are you(?: doing)?|what(?:'s| is) up)[.!?\s]*$/i.test(value)) {
      state.profile.introAsked=true;state.profile.awaitingFirstName=true;
      persist();
      message("Hi! 😊 I'm Sam, and I can help answer your questions about buying or selling in Raleigh.",false);
      resumeAfterQuestion();
      return;
    }
    if (!replaying && !state.profile.introAsked && !state.intent && !state.booking && !state.contact &&
        engine.isUnclearAnswer(value, "intro")) {
      scheduleClarification("Sorry, I don't quite understand. " + config.welcome);
      return;
    }
    if (!replaying && !state.profile.introAsked && !state.profile.skipName && !state.intent && !state.booking && !state.contact &&
        !/^(?:hi|hello|hey|good (?:morning|afternoon|evening)|no|nope|nah|not really|one sec(?:ond)?)\s*[.!?]*$/i.test(value)) {
      state.profile.introAsked = true;
      state.profile.awaitingFirstName = true;
      state.profile.pendingIntroReply = value;
      persist();
      if (engine.isSensitiveFamilyReason(value)) message("I'm so sorry to hear that.", false);
      message("😊 I'm Sam, and I can help answer your questions about buying or selling in Raleigh. May I have your first name so I can personalize things for you?", false);
      return;
    }
    if (state.profile.skipName && !state.profile.introAsked) {
      state.profile.introAsked = true;
      message("Of course. I'm Sam, and I'm happy to help with your questions without asking for your name.", false);
    }
    if (state.profile.awaitingOriginState) {
      var originCity = state.profile.awaitingOriginState;
      if (/\b(?:rather not|prefer not|skip|don't want to share)\b/i.test(value)) {
        delete state.profile.awaitingOriginState; state.profile.originDisambiguationDeclined = true; askQuestion("No problem."); return;
      }
      var originState = engine.resolveOrigin({type:'out',place:value.trim().replace(/[.!?]+$/, '')},config);
      if (originState.stateCode) {
        state.profile.facts.location = Object.assign({},originState,{city:originCity.toLowerCase()});
        delete state.profile.awaitingOriginState; applyKnownFacts(); askQuestion("Got it—" + originCity + ", " + config.originStates[originState.stateCode] + "."); return;
      }
      if (!engine.asksQuestion(value)) { askQuestion(); return; }
    }
    if (engine.declinesScheduling(value) && state.booking) {
      state.booking = null;
      message("Of course—we don't need to schedule anything.", false);
      if (state.intent) askQuestion();
      else message("What would you like to know about Raleigh?", false);
      return;
    }
    if ((state.profile.remoteWork || state.profile.facts.remoteWork) && state.profile.currentQuestionKey && /^commute/.test(state.profile.currentQuestionKey)) {
      state.profile.remoteWork=true;state.profile.commuteMentioned=false;state.profile.commuteDestinationKnown=true;state.profile.commuteRangeKnown=true;
      state.profile.currentQuestionKey='';askQuestion("Got it—with remote work, we can focus on the areas and home that suit you.");return;
    }
    if (state.profile.facts.areaCorrection) { delete state.profile.facts.areaCorrection; askQuestion("Got it—I'll keep that area preference in mind.");return; }
    var correctedIntent = detectIntent(value);
    if (state.intent==='selling' && state.combined && state.profile.facts.combined && correctedIntent && correctedIntent.id==='buying' && /\b(?:also|too|as well)\b/i.test(value)) {
      askQuestion("Got it—we'll plan your sale and next purchase together.");return;
    }
    if (state.intent === 'investing' && !state.profile.investmentSale && state.profile.facts.investmentSale && !state.booking) {
      state.profile.investmentSale = true;
      state.question = activeQuestions().findIndex(function (question) { return question.key === 'salePriority'; });
      askQuestion(); return;
    }
    if (engine.rentalOnly(value)) { explainRentalOnly(); return; }
    if (state.profile.rentalOnly && (!correctedIntent || correctedIntent.id === 'investing') && !/\b(?:invest|buy|purchase|own a rental|landlord)\b/i.test(value)) {
      message("I'm happy to answer general Raleigh questions. Our guides can help with getting to know the area, but we don't offer a rental search service.", false);
      return;
    }
    if (correctedIntent && /\b(?:actually|switch|instead|decided|focus on|main goal|no longer)\b/i.test(value) &&
        state.intent && correctedIntent.id !== state.intent) {
      state.booking = null;
      state.profile.rentalOnly = false;
      message("Got it—let's focus on " + (correctedIntent.id === 'investing' ? 'your investment' : correctedIntent.id === 'selling' ? 'your sale' : 'the home you want to buy') + ".", false);
      startFlow(correctedIntent.id, true, correctedIntent.combined, value);
      return;
    }
    if (engine.explicitBooking(value)) {
      state.profile.noScheduling = false; state.profile.researchOnly = false; state.profile.informationOnly = false;
    }
    if (state.profile.informationOnly && (asksForBenjaminNumber(value) || asksForTeamMember(value)) && !engine.explicitBooking(value)) {
      message("You can call or text the team at " + (config.benjaminDirectPhone || '919-737-7896') + ".", false); return;
    }
    if (/^(?:please\s+|yes[, ]+)?(?:contact me|have (?:someone|the team) (?:contact|call|text) me|send (?:a |the )?message)\b/i.test(value) && !engine.declinesContact(value)) {
      state.profile.informationOnly = false; showContact(); return;
    }
    if (engine.researchOnly(value) || state.profile.noContact && /\b(?:question|guidance|information)\b/i.test(value) && !engine.explicitBooking(value) || state.profile.informationOnly && !engine.explicitBooking(value)) {
      state.intent = correctedIntent ? correctedIntent.id : state.intent;
      informationalReply(value); return;
    }
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
        offerBrowsingHelp();
      } else {
        state.profile.awaitingVisitReason = true;
        persist();
        message("What has you looking at our website today?", false);
      }
      return;
    }
    if (!state.booking && !state.contact && /^(?:hi|hello|hey|good morning|good afternoon|good evening|one sec(?:ond)?|just a sec(?:ond)?|let me think|hmm|um+)\s*[.!?]*$/i.test(value)) {
      var pendingQuestion = state.intent && state.question >= 0 && state.question < activeQuestions().length
        ? activeQuestions()[state.question].text : config.fallback;
      scheduleClarification("Hi! " + pendingQuestion);
      return;
    }
    var answering = state.intent && (activeQuestions().find(function(q){return q.key===state.profile.currentQuestionKey;}) || activeQuestions()[state.question]);
    if (!state.booking && answering && /^(?:timing|leaseEnd|jobStart)$/.test(answering.key) && !/\?/.test(value) && /^when (?:my|our|the)\b/i.test(value)) { acceptAnswer(value); return; }
    var faq = engine.findFaq(value, config);
    if (isQuestionPreamble(value)) {
      state.questionDetour = true;
      persist();
      message("Absolutely, what's the question that you have?", false);
      return;
    }
    var conditionalMeeting = /\b(?:if|when)\s+(?:we|i)\s+(?:do\s+)?(?:talk|meet|call|book)\b/i.test(value);
    var directContactQuestion = !conditionalMeeting && (asksForBenjaminNumber(value) || asksForTeamMember(value));
    var selectingTime = state.booking && state.booking.step === "choose" && (hasBookingPreference(value) || !!requestedClock(value) || /\b(?:first|second|one|two|1|2|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.test(value));
    if (state.questionDetour) {
      state.questionDetour = false;
      persist();
      faq = faq || engine.findFaq(value + "?", config);
      if (!selectingTime && (directContactQuestion || faq || engine.asksQuestion(value))) {
        answerSideQuestion(value, faq);
        return;
      }
    }
    if (asksToMeetNamedHost(value) && !directContactQuestion && (!state.booking || state.booking.step==='choose')) {
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
      message(config.rentalConversation.services, false);
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
    if (/\b(?:rain|forecast|temperature|weather tomorrow|weather today)\b/i.test(value) && engine.asksQuestion(value)) {
      message("I don't have a live weather forecast. I can help with your Raleigh real estate questions, though.", false);
      if (state.intent) askQuestion();
      return;
    }
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
      if (explicitTopicChange && detected && detected.id !== state.intent && !(state.intent === "selling" && (detected.id === "relocating" || activeQuestions()[state.question].key === "nextDestination")) && !((state.intent === "buying" && detected.id === "relocating") || (state.intent === "relocating" && detected.id === "buying"))) {
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
    incomingGeneration+=1;incomingQueue=Promise.resolve();
    if(understanding){understanding.cancel();aiStatus.textContent='AI interpreter ready · existing bot is backup';}
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
      message(config.welcome, false, { initial: true });
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
    message(config.welcome, false, { initial: true });
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
    receiveText(value);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) close();
  });
  restore();
  sizeInput();
  refreshAttention();
})();
