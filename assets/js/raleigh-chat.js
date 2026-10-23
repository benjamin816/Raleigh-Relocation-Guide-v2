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

  var state = { intent: null, question: -1, answers: [], started: false, lastFocus: null, contact: null, submitting: false };
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
  function message(text, byUser) {
    var row = document.createElement("div");
    row.className = "rchat-row" + (byUser ? " rchat-row--user" : "");
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
    var timestamp = document.createElement("time");
    var now = new Date();
    timestamp.className = "rchat-time";
    timestamp.dateTime = now.toISOString();
    timestamp.textContent = now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    bubble.appendChild(timestamp);
    content.appendChild(bubble);
    row.appendChild(content);
    log.appendChild(row);
    scrollToEnd();
    return bubble;
  }
  function safeLink(href) {
    return typeof href === "string" && /^\/(?!\/)[a-z0-9\-_/]*$/i.test(href) ? href : null;
  }
  function link(label, href) {
    var url = safeLink(href);
    if (!url) return;
    var bubble = message("You can ", false);
    var a = document.createElement("a");
    a.className = "rchat-link";
    a.href = url;
    a.textContent = label.toLowerCase();
    var timestamp = bubble.querySelector(".rchat-time");
    bubble.insertBefore(a, timestamp);
    bubble.insertBefore(document.createTextNode(" whenever you're ready."), timestamp);
    scrollToEnd();
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
  function startFlow(id) {
    var flow = config.flows[id];
    if (!flow) return;
    state.intent = id;
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
    state.answers.push(String(answer));
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
    message(value, true);
    sound();
    if (state.contact) { handleContactAnswer(value); return; }
    if (/^(contact|send a message|ask a question|talk to someone|speak to someone|human)$/i.test(value)) {
      showContact();
      return;
    }
    if (/^(start over|restart|reset)$/i.test(value)) {
      state.intent = null;
      state.question = -1;
      state.answers = [];
      message(config.welcome, false);
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
    window.dispatchEvent(new CustomEvent("tawk-lead-popup-state", { detail: { blocked: false, reason: "custom_chat_closed" } }));
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
})();
