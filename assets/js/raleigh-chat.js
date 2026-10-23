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
      '<header class="rchat-head"><img class="rchat-avatar" alt="" /><span class="rchat-head-copy"><strong class="rchat-head-title"></strong><span class="rchat-head-sub">Local guidance • automated answers</span></span><button class="rchat-close" type="button" aria-label="Close chat">×</button></header>' +
      '<div class="rchat-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<form class="rchat-compose"><input class="rchat-input" type="text" maxlength="500" aria-label="Type a message" placeholder="Ask about Raleigh..." autocomplete="off" /><button class="rchat-send" type="submit" aria-label="Send message">➤</button></form>' +
      '<div class="rchat-footnote">Automated guide, not a live chat. No messages are stored here.</div>' +
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

  var state = { intent: null, question: -1, answers: [], started: false, lastFocus: null };
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
    var bubble = document.createElement("div");
    bubble.className = "rchat-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    log.appendChild(row);
    scrollToEnd();
  }
  function clearActions() {
    log.querySelectorAll(".rchat-actions--choices").forEach(function (node) { node.remove(); });
  }
  function choices(items, onChoose) {
    clearActions();
    var wrap = document.createElement("div");
    wrap.className = "rchat-actions rchat-actions--choices";
    items.forEach(function (item) {
      var button = document.createElement("button");
      button.className = "rchat-choice";
      button.type = "button";
      button.textContent = item.label || item;
      button.addEventListener("click", function () {
        var label = item.label || item;
        wrap.remove();
        message(label, true);
        sound();
        onChoose(item);
      });
      wrap.appendChild(button);
    });
    log.appendChild(wrap);
    scrollToEnd();
  }
  function safeLink(href) {
    return typeof href === "string" && /^\/(?!\/)[a-z0-9\-_/]*$/i.test(href) ? href : null;
  }
  function link(label, href) {
    var url = safeLink(href);
    if (!url) return;
    var wrap = document.createElement("div");
    wrap.className = "rchat-actions";
    var a = document.createElement("a");
    a.className = "rchat-link";
    a.href = url;
    a.textContent = label;
    wrap.appendChild(a);
    log.appendChild(wrap);
    scrollToEnd();
  }
  function topicChoices() {
    choices(config.topics, function (item) { startFlow(item.id); });
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
      choices([{ label: "Send a question", id: "contact" }, { label: "Explore another topic", id: "restart" }], function (item) {
        if (item.id === "contact") showContact();
        else { state.intent = null; message(config.fallback, false); topicChoices(); }
      });
      return;
    }
    var question = flow.questions[state.question];
    message(question.text, false);
    choices(question.choices, function (choice) { acceptAnswer(choice); });
  }
  function acceptAnswer(answer) {
    state.answers.push(String(answer));
    state.question += 1;
    askQuestion();
  }
  function showContact() {
    message(config.contactPrompt, false);
    var form = document.createElement("form");
    form.className = "rchat-form";
    form.innerHTML =
      '<label>Your name<input name="name" type="text" maxlength="100" autocomplete="name" required /></label>' +
      '<label>Email<input name="email" type="email" maxlength="200" autocomplete="email" required /></label>' +
      '<label>Phone (optional)<input name="phone" type="tel" maxlength="30" autocomplete="tel" /></label>' +
      '<label>Your question<textarea name="question" maxlength="2000" required></textarea></label>' +
      '<label class="rchat-consent"><input name="consent" type="checkbox" required /> I agree to be contacted about my question.</label>' +
      '<button type="submit"></button><p class="rchat-form-note"></p>';
    var button = form.querySelector("button");
    var note = form.querySelector(".rchat-form-note");
    var hasEndpoint = Boolean(safeLink(config.leadEndpoint));
    button.textContent = hasEndpoint ? "Send my question" : "Open my email app";
    note.textContent = hasEndpoint
      ? "Your details will be submitted to this site's secure contact endpoint."
      : "This site has no verified chat storage endpoint yet. This opens an email draft on your device; nothing is sent until you send it.";
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var payload = {
        source: "website_rule_chat",
        source_page: window.location.pathname,
        intent: state.intent || "general",
        answers: state.answers.slice(),
        name: String(data.get("name") || "").trim(),
        email: String(data.get("email") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        question: String(data.get("question") || "").trim(),
        consent: data.get("consent") === "on"
      };
      if (!payload.consent || !payload.name || !payload.question) return;
      if (!hasEndpoint) {
        var subject = encodeURIComponent("Raleigh website question — " + payload.intent);
        var body = encodeURIComponent("Name: " + payload.name + "\nEmail: " + payload.email + "\nPhone: " + payload.phone + "\nInterest: " + payload.intent + "\nAnswers: " + payload.answers.join(" / ") + "\nQuestion: " + payload.question);
        window.location.href = "mailto:" + config.emailAddress + "?subject=" + subject + "&body=" + body;
        message("Your email app should open with a draft. Please press Send there; this chat has not stored your details.", false);
        return;
      }
      button.disabled = true;
      window.fetch(config.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (!response.ok) throw new Error("Request failed");
        return response.json();
      }).then(function (result) {
        if (!result || result.ok !== true) throw new Error("No confirmation");
        form.remove();
        message("Your question reached our team. Thank you!", false);
      }).catch(function () {
        note.textContent = "We could not confirm delivery. Please try again or book a call.";
        button.disabled = false;
      });
    });
    log.appendChild(form);
    scrollToEnd();
    form.querySelector("input").focus();
  }
  function handleText(text) {
    var value = text.trim();
    if (!value) return;
    message(value, true);
    sound();
    if (state.intent && state.question >= 0 && state.question < config.flows[state.intent].questions.length) {
      clearActions();
      acceptAnswer(value.slice(0, 160));
      return;
    }
    var detected = detectIntent(value);
    if (detected) startFlow(detected);
    else { message(config.fallback, false); topicChoices(); }
  }
  function open() {
    state.lastFocus = document.activeElement;
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute("aria-expanded", "true");
    window.dispatchEvent(new CustomEvent("tawk-lead-popup-state", { detail: { blocked: true, reason: "custom_chat_open" } }));
    if (!state.started) {
      state.started = true;
      message(config.welcome, false);
      topicChoices();
    }
    input.focus();
  }
  function close() {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
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
