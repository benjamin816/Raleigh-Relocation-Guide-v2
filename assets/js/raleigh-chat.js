(function () {
  "use strict";
  var config = window.RaleighChatConfig;
  if (!config || document.querySelector(".rchat")) return;
  var path = window.location.pathname.replace(/index\.html$/, "");
  if (config.excludedPaths.indexOf(path) !== -1) return;

  var root = document.createElement("aside");
  root.className = "rchat";
  root.setAttribute("aria-label", "Raleigh website help");
  root.innerHTML =
    '<section class="rchat-panel" role="dialog" aria-label="Raleigh website help" aria-modal="false" hidden>' +
      '<header class="rchat-head"><img class="rchat-avatar" alt="" /><span class="rchat-head-copy"><strong class="rchat-head-title"></strong></span><button class="rchat-close" type="button" aria-label="Close chat">×</button></header>' +
      '<div class="rchat-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<form class="rchat-compose"><input class="rchat-input" type="text" maxlength="500" aria-label="Type a message" placeholder="Type a Message..." autocomplete="off" /><button class="rchat-send" type="submit" aria-label="Send message">➤</button></form>' +
    '</section>' +
    '<button class="rchat-launch" type="button" aria-label="Open Raleigh help chat" aria-expanded="false">' +
      '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 7h20a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H15l-8 5v-5H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z"/><path d="M10 14h12M10 19h8"/></svg>' +
    '</button>';
  document.body.appendChild(root);

  var panel = root.querySelector(".rchat-panel");
  var launcher = root.querySelector(".rchat-launch");
  var closeButton = root.querySelector(".rchat-close");
  var log = root.querySelector(".rchat-log");
  var compose = root.querySelector(".rchat-compose");
  var input = root.querySelector(".rchat-input");
  var avatar = root.querySelector(".rchat-avatar");
  avatar.src = config.avatar;
  root.querySelector(".rchat-head-title").textContent = config.title;

  var storageKey = "raleigh-guide-chat-v1";
  var storageDays = Number.isInteger(config.conversationMemoryDays) ? Math.max(1, Math.min(config.conversationMemoryDays, 365)) : 180;
  var state = { intent: null, question: -1, answers: [], memories: {}, history: [], started: false, lastFocus: null, contact: null, submitting: false, sentMessageSinceOpen: false };
  function redact(text) {
    return String(text).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
      .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone removed]").slice(0, 500);
  }
  function persist() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 1, updatedAt: Date.now(), started: state.started,
        intent: state.intent, question: state.question,
        answers: state.answers.map(redact).slice(0, 12),
        memories: state.memories, history: state.history.slice(-80)
      }));
    } catch (_) { /* Browsers may block local storage. Chat still works for this visit. */ }
  }
  function restore() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (!saved || saved.version !== 1 || !Number.isFinite(saved.updatedAt) ||
          Date.now() - saved.updatedAt > storageDays * 86400000 || saved.updatedAt > Date.now() + 86400000) return;
      state.started = saved.started === true;
      state.intent = Object.prototype.hasOwnProperty.call(config.flows, saved.intent) ? saved.intent : null;
      state.question = Number.isInteger(saved.question) ? Math.max(-1, Math.min(saved.question, state.intent ? config.flows[state.intent].questions.length : -1)) : -1;
      state.answers = Array.isArray(saved.answers) ? saved.answers.filter(function (item) { return typeof item === "string"; }).slice(0, 12).map(redact) : [];
      if (saved.memories && typeof saved.memories === "object" && !Array.isArray(saved.memories)) {
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
  function scrollToEnd() { log.scrollTop = log.scrollHeight; }
  function message(text, byUser, options) {
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
      bubble.appendChild(document.createTextNode(" whenever you're ready."));
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
    scrollToEnd();
    if (!options.restoring && options.remember !== false && !state.contact) {
      state.history.push({ text: redact(text), byUser: !!byUser, at: now.toISOString(), link: options.link || null });
      state.history = state.history.slice(-80);
      persist();
    }
    return bubble;
  }
  function safeLink(href) {
    return typeof href === "string" && /^\/(?!\/)[a-z0-9\-_/]*$/i.test(href) ? href : null;
  }
  function link(label, href) {
    var url = safeLink(href);
    if (!url) return;
    message("You can ", false, { link: { label: label.toLowerCase(), href: url } });
  }
  function detectIntent(text) {
    var lower = text.toLowerCase();
    var best = null;
    var score = 0;
    Object.keys(config.flows).forEach(function (id) {
      var matches = config.flows[id].keywords.filter(function (word) {
        return lower.indexOf(word.toLowerCase()) !== -1;
      }).length;
      if (matches > score) { score = matches; best = id; }
    });
    return best;
  }
  function memorySummary(id) {
    var flow = config.flows[id];
    var answers = state.memories[id] || [];
    if (!flow || !answers.length) return "";
    return answers.slice(0, 3).map(function (answer, index) {
      return "When I asked “" + flow.questions[index].text + "” you said “" + answer + "”.";
    }).join(" ");
  }
  function startFlow(id, fresh) {
    var flow = config.flows[id];
    if (!flow) return;
    state.intent = id;
    if (!fresh && state.memories[id] && state.memories[id].length) {
      state.answers = state.memories[id].slice();
      state.question = flow.questions.length;
      message("I remember our earlier conversation about " + id + ". " + memorySummary(id) + " What would you like to explore next? Type 'start over' if you'd like to answer those questions again.", false);
      link("Book a one-on-one call", config.bookingLinks[flow.booking]);
      if (flow.secondaryLink) link(flow.secondaryLink.label, flow.secondaryLink.href);
      return;
    }
    state.question = 0;
    state.answers = [];
    message(flow.intro, false);
    askQuestion();
  }
  function askQuestion() {
    var flow = config.flows[state.intent];
    if (state.question >= flow.questions.length) {
      message(flow.finish, false);
      link("Book a one-on-one call", config.bookingLinks[flow.booking]);
      if (flow.secondaryLink) link(flow.secondaryLink.label, flow.secondaryLink.href);
      message("If you'd like a personal answer, type 'contact' and I'll take your details. You can also tell me about another Raleigh topic.", false);
      return;
    }
    var question = flow.questions[state.question];
    message(question.text, false);
  }
  function acceptAnswer(answer) {
    state.answers.push(redact(answer));
    state.memories[state.intent] = state.answers.slice();
    state.question += 1;
    askQuestion();
  }
  function showContact() {
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
    var details = state.contact.data;
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
      submission_id: state.contact.submissionId
    };
    state.submitting = true;
    input.disabled = true;
    root.querySelector(".rchat-send").disabled = true;
    message("Sending your request now...", false);
    window.fetch(config.leadEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload)
    }).then(function () {
      state.contact = null;
      message("Your request was submitted for processing. Thank you!", false);
      window.dispatchEvent(new CustomEvent("raleigh-lead-form-submitted", { detail: { source: "website_chat" } }));
      input.maxLength = 500;
    }).catch(function () {
      message("I couldn't submit that request. Reply yes to retry or no to cancel.", false);
    }).finally(function () {
      state.submitting = false;
      input.disabled = false;
      root.querySelector(".rchat-send").disabled = false;
      input.focus();
    });
  }
  function handleContactAnswer(value) {
    var contact = state.contact;
    var step = contact.step;
    if (step >= config.contactQuestions.length) {
      if (/^(yes|yes please|i agree|submit)$/i.test(value)) submitContact();
      else if (/^(no|cancel)$/i.test(value)) {
        state.contact = null;
        input.maxLength = 500;
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
    if (!value || state.submitting) return;
    state.sentMessageSinceOpen = true;
    if (/^(forget|forget me|clear chat|delete chat history)$/i.test(value)) {
      try { window.localStorage.removeItem(storageKey); } catch (_) { /* Storage may be unavailable. */ }
      state.intent = null;
      state.question = -1;
      state.answers = [];
      state.memories = {};
      state.history = [];
      state.contact = null;
      state.started = true;
      input.maxLength = 500;
      log.replaceChildren();
      message("This browser's chat history is cleared. What would you like to discuss?", false, { remember: false });
      sound();
      return;
    }
    var contactCommand = /^(contact|send a message|ask a question|talk to someone|speak to someone|human)$/i.test(value);
    message(value, true, { remember: !state.contact && !contactCommand });
    sound();
    if (state.contact) { handleContactAnswer(value); return; }
    if (contactCommand) {
      showContact();
      return;
    }
    if (/^(start over|restart|reset)$/i.test(value)) {
      if (state.intent) {
        var previous = state.intent;
        delete state.memories[previous];
        startFlow(previous, true);
      } else message(config.welcome, false);
      return;
    }
    if (/^(what do you remember|what did i tell you|my details)$/i.test(value)) {
      var remembered = Object.keys(state.memories).filter(function (id) { return state.memories[id].length; });
      message(remembered.length ? remembered.map(memorySummary).join(" ") : "I don't have any earlier answers saved on this browser yet.", false);
      return;
    }
    if (state.intent && state.question >= 0 && state.question < config.flows[state.intent].questions.length) {
      acceptAnswer(value.slice(0, 160));
      return;
    }
    var detected = detectIntent(value);
    if (detected) startFlow(detected);
    else message(config.fallback, false);
  }
  function open() {
    state.lastFocus = document.activeElement;
    state.sentMessageSinceOpen = false;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close Raleigh help chat");
    window.dispatchEvent(new CustomEvent("tawk-lead-popup-state", { detail: { blocked: true, reason: "custom_chat_open" } }));
    if (!state.started) {
      state.started = true;
      message(config.welcome, false);
    }
    input.focus();
  }
  function close() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open Raleigh help chat");
    window.dispatchEvent(new CustomEvent("tawk-lead-popup-state", { detail: { blocked: false, reason: "custom_chat_closed", sentMessage: state.sentMessageSinceOpen } }));
    (state.lastFocus && state.lastFocus.focus ? state.lastFocus : launcher).focus();
  }
  launcher.addEventListener("click", function () { panel.hidden ? open() : close(); });
  closeButton.addEventListener("click", close);
  compose.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = input.value;
    input.value = "";
    handleText(value);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) close();
  });
  restore();
})();
