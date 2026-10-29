(function (root, factory) {
  var engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  else root.RaleighChatEngine = engine;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function normalize(value) { return String(value || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim(); }
  function hasPhrase(text, phrase) {
    var escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^a-z0-9])" + escaped + "(?=$|[^a-z0-9])", "i").test(text);
  }
  // Correct one missing, extra, or mistyped letter in a small set of routing words.
  // Keep names, places, and free-form answers untouched.
  var routingWords = ["moving", "buying", "selling", "relocating", "investing", "renting", "rental", "purchase", "purchasing", "booking", "appointment", "schedule"];
  function oneEditAway(word, target) {
    if (word.charAt(0) !== target.charAt(0) || Math.abs(word.length - target.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < word.length && j < target.length) {
      if (word.charAt(i) === target.charAt(j)) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (word.length >= target.length) i++;
      if (target.length >= word.length) j++;
    }
    return edits + (i < word.length || j < target.length ? 1 : 0) <= 1;
  }
  function normalizeRouting(value) {
    return normalize(value).replace(/\b[a-z]{5,}\b/g, function (word) {
      if (routingWords.indexOf(word) !== -1) return word;
      var matches = routingWords.filter(function (target) { return oneEditAway(word, target); });
      return matches.length === 1 ? matches[0] : word;
    });
  }
  function detectIntent(value, config) {
    var text = normalizeRouting(value);
    var sell = /\b(sell|selling|seller|list my|listing my|home value|house value)\b/.test(text);
    var buy = /\b(buy|buying|buyer|purchase|purchasing|looking for a home)\b/.test(text);
    if (sell && buy) return { id: "selling", combined: true };
    if (/\b(invest(?:ing|ment|or)?|rental(?: property| home)?|airbnb|dscr|cash ?flow|cap rate|multifamily)\b/.test(text)) {
      return { id: "investing", combined: false };
    }
    var best = null, score = 0;
    Object.keys(config.flows || {}).forEach(function (id) {
      var matches = (config.flows[id].keywords || []).filter(function (word) {
        var term = normalize(word);
        return term && (hasPhrase(text, term) || (term.length > 4 && text.indexOf(term) !== -1));
      }).length;
      if (matches > score) { score = matches; best = id; }
    });
    return best ? { id: best, combined: false } : null;
  }
  function findFaq(value, config) {
    var text = normalize(value);
    var question = /\?|^(how|what|where|when|why|can|do|does|is|are|tell me|explain)\b/.test(text);
    if (!question) return null;
    var best = null, length = 0;
    (config.faq || []).forEach(function (item) {
      (item.keywords || []).forEach(function (word) {
        if (hasPhrase(text, word) && word.length > length) { best = item; length = word.length; }
      });
    });
    return best;
  }
  function wantsResources(value) { return /\b(resources?|guides?|articles?|blogs?|learn more|website|web page|where can i (?:read|learn))\b/i.test(value); }
  function wantsBooking(value) { return /\b(book|booking|schedule|appointment|call|talk to (you|the team)|meet with)\b/i.test(normalizeRouting(value)); }
  function asksQuestion(value) { return /\?|^\s*(how|what|where|when|why|can|could|do|does|is|are|should|tell me|explain)\b/i.test(value); }
  function detectLocation(value, config) {
    var text = normalize(value);
    var barePlace = text.replace(/^[\s.,!?]+|[\s.,!?]+$/g, "");
    if (/^(?:raleigh|cary|durham|the triangle|north carolina|nc)$/.test(barePlace)) return { type: "local", place: "" };
    if (config && Object.keys(config.originStates || {}).some(function (code) {
      return barePlace === code.toLowerCase() || barePlace === normalize(config.originStates[code]);
    })) return { type: "out", place: barePlace };
    if (config && Object.keys(config.originCities || {}).some(function (code) {
      return (config.originCities[code] || []).some(function (city) { return barePlace === normalize(city); });
    })) return { type: "out", place: barePlace };
    if (/\b(already (?:live|living|here|local)|(?:i (?:live|am living|am)|i'm) (?:here|in (?:(?:north|south|east|west) )?(?:raleigh|cary|durham|the triangle))|i'm local|i am local|from (?:raleigh|cary|durham))\b/.test(text)) return { type: "local", place: "" };
    var from = text.match(/\b(?:from|live in|living in|moving from|relocating from|i am in|i'm in|we are in)\s+([a-z][a-z .-]{1,35}?)(?=\s*(?:,|\.|!|\?|$|\s+(?:and|because|but|to|for)\b))/);
    if (from && !/^(?:raleigh|cary|durham|the triangle|north carolina|nc|out of state)$/.test(from[1].trim())) return { type: "out", place: from[1].trim().replace(/\s+/g, " ") };
    if (/\bout of state\b/.test(text)) return { type: "out", place: "" };
    if (/\b(local|already here|in the triangle)\b/.test(text)) return { type: "local", place: "" };
    return null;
  }
  function resolveOrigin(location, config) {
    if (!location || location.type !== "out" || !location.place) return location;
    var raw = normalize(location.place).replace(/[.,]+$/, "");
    var states = config.originStates || {};
    var cities = config.originCities || {};
    var codes = Object.keys(states);
    var stateCode = codes.find(function (code) {
      return raw === code.toLowerCase() || raw === normalize(states[code]);
    });
    if (stateCode) return { type: "out", place: states[stateCode].toLowerCase(), stateCode: stateCode, city: "" };
    var explicit = raw.match(/^(.+?)[, ]+([a-z]{2})$/);
    if (explicit && states[explicit[2].toUpperCase()]) {
      stateCode = explicit[2].toUpperCase();
      return { type: "out", place: states[stateCode].toLowerCase(), stateCode: stateCode, city: explicit[1] };
    }
    if ((config.originAmbiguousCities || []).some(function (city) { return normalize(city) === raw; })) {
      return { type: "out", place: raw, stateCode: "", city: "" };
    }
    var cityMatches = codes.filter(function (code) {
      return (cities[code] || []).some(function (city) {
        return normalize(city).replace(/[.]/g, "") === raw.replace(/[.]/g, "");
      });
    });
    if (cityMatches.length === 1) {
      stateCode = cityMatches[0];
      return { type: "out", place: states[stateCode].toLowerCase(), stateCode: stateCode, city: raw };
    }
    return { type: "out", place: raw, stateCode: "", city: "" };
  }
  function detectTenure(value) {
    var text = normalizeRouting(value);
    if (/\b(rent|renting|renter|lease|tenant)\b/.test(text)) return "renting";
    if (/\b(own|owner|homeowner|mortgage|my house|my home)\b/.test(text)) return "owning";
    return null;
  }
  function isUnclearAnswer(value, questionKey) {
    var text = normalize(value).replace(/[.!?]+$/, "").trim();
    if (questionKey === "intro" && /^(?:not sure|i don't know|idk)$/.test(text)) return true;
    if (/^(?:bruh|bro|lol|lmao|huh|what|whatever|okay|ok|sure|yep|yeah|nah|um+|hmm+)$/.test(text)) return true;
    if (!/^(?:whyRaleigh|priorities|priorityMore|home|homeMore)$/.test(questionKey || "")) return false;
    if (!/^[a-z]{3,20}$/.test(text)) return false;
    return !/^(?:weather|climate|warmth|family|friends|job|work|career|retirement|prices?|affordability|cost|commute|schools?|shopping|amenities|walkability|safety|space|yard|backyard|bedrooms?|bathrooms?|garage|pool|office|location|quiet|community|lifestyle|opportunity|opportunities|raleigh|cary|apex|durham)$/.test(text);
  }
  function extractFirstName(value) {
    var text = String(value || "").trim();
    if (!text || /\?/.test(text)) return null;
    text = text.replace(/^(?:my name is|i am|i'm|call me)\s+/i, "").replace(/[.!]+$/, "").trim();
    if (!/^[a-z][a-z'-]{1,34}(?:\s+[a-z][a-z'-]{1,34})?$/i.test(text)) return null;
    var first = text.split(/\s+/)[0];
    if (/^(?:what|why|who|where|when|how|huh|wait|sorry|thanks|okay|sure|yeah|nope|hello|there)$/i.test(first)) return null;
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  function classifyMoveTiming(value, now) {
    var text = normalize(value);
    if (/\b(?:not now|not soon|not sure|don't know)\b/.test(text)) return "";
    if (/\b(now|asap|immediately|right away|this week|next week|this month|next month|soon)\b/.test(text)) return "soon";
    var words = { one: 1, two: 2, three: 3, four: 4, six: 6 };
    var relative = text.match(/\b(?:in|within|about|around|roughly|approximately)?\s*(\d+|one|two|three|four|six|a couple(?: of)?|a few)\s*(days?|weeks?|months?)\b/);
    if (relative) {
      var amount = /^a couple/.test(relative[1]) ? 2 : relative[1] === "a few" ? 3 : (words[relative[1]] || Number(relative[1]));
      var unit = relative[2];
      if (amount <= (unit.indexOf("day") === 0 ? 92 : unit.indexOf("week") === 0 ? 13 : 3)) return "soon";
    }
    var months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    var month = months.findIndex(function (name) { return new RegExp("\\b" + name + "\\b").test(text); });
    var newYear = /\b(?:new year|new year's|jan(?:uary)?)\b/.test(text);
    if (month < 0 && newYear) month = 0;
    if (month < 0) return "";
    var date = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    var yearMatch = text.match(/\b20\d{2}\b/);
    var year = yearMatch ? Number(yearMatch[0]) : date.getFullYear() + (month < date.getMonth() ? 1 : 0);
    if (!yearMatch && /\bnext year\b/.test(text)) year = date.getFullYear() + 1;
    var monthsAway = (year - date.getFullYear()) * 12 + month - date.getMonth();
    return monthsAway >= 0 && monthsAway <= 3 ? (newYear ? "newYear" : "soon") : "";
  }
  function activeQuestions(flow, profile, combined) {
    return (flow && flow.questions || []).filter(function (question) {
      switch (question.when || "always") {
        case "local": return profile.location === "local";
        case "out": return profile.location === "out";
        case "newJob": return profile.newJob === true;
        case "shortTiming": return !!profile.shortTiming;
        case "rentalClarificationNeeded": return profile.rentalClarificationNeeded === true;
        case "renting": return profile.location === "local" && profile.tenure === "renting";
        case "owning": return profile.location === "local" && profile.tenure === "owning";
        case "family": return profile.familyNearby === true;
        case "familyBeforePriorities": return profile.familyNearby === true && (profile.priorityAnswered !== true || profile.familyAreaAsked === true);
        case "familyAreaNeeded": return profile.familyNearby === true && profile.priorityAnswered === true && !profile.familyArea && profile.familyAreaAsked !== true;
        case "needsPriorities": return profile.prioritiesKnown !== true;
        case "outNeedsPriorities": return profile.location === "out" && profile.prioritiesKnown !== true;
        case "areaReasonNeeded": return profile.areasNeedFollowup === true;
        case "prioritySingle": return profile.prioritySingle === true;
        case "commuteDestinationNeeded": return profile.commuteMentioned === true && profile.remoteWork !== true && profile.retired !== true && profile.commuteDestinationKnown !== true;
        case "commuteRangeNeeded": return profile.commuteMentioned === true && profile.remoteWork !== true && profile.retired !== true && profile.commuteDestinationKnown === true && profile.commuteRangeKnown !== true;
        case "priorityPrice": return profile.priorityPrice === true && profile.budgetAsked !== true;
        case "priorityFinancingNeeded": return profile.priorityPrice === true && profile.budgetAsked === true && profile.financingKnown !== true;
        case "homeSingle": return profile.homeSingle === true;
        case "budgetNeeded": return profile.budgetKnown !== true && profile.budgetAsked !== true;
        case "budgetKnown": return profile.budgetKnown === true && profile.financingKnown !== true;
        case "needsPreapproval": return profile.usingFinancing === true && profile.preApproved !== true && profile.preapprovalAsked !== true;
        case "combined": return combined === true;
        case "solo": return combined !== true;
        default: return true;
      }
    });
  }
  function classifySafety(value, previous) {
    var text = normalize(value);
    var links = text.match(/(?:https?:\/\/|www\.)[^\s]+/g) || [];
    if (/\b(?:nigg(?:er|a)|kike|spic|chink)\b/.test(text)) return "hate";
    if (/\b(kill|hurt|attack|threaten)\s+(you|your team|your agents)\b/.test(text)) return "threat";
    if (links.some(function (link) {
      try {
        var host = new URL(link.indexOf("www.") === 0 ? "https://" + link : link).hostname;
        return !/(^|\.)(?:zillow\.com|redfin\.com|realtor\.com|raleighncguide\.com)$/.test(host);
      } catch (_) { return true; }
    })) return "spam";
    if (/([^\s])\1{12,}/.test(text) || /^[bcdfghjklmnpqrstvwxz]{5,12}$/.test(text) || /\b[bcdfghjklmnpqrstvwxyz]{9,}\b/.test(text) || /\b(?:asdf|qwer|zxcv){2,}\b/.test(text)) return "gibberish";
    if (previous && text === normalize(previous) && text.length > 60) return "spam";
    if (/\b(fuck|screw)\s+(you|your team|your agents)\b/.test(text)) return "abuse";
    if (/\b(no (?:black|immigrant)|avoid (?:black|asian|hispanic|muslim|jewish|gay) (?:people|neighbors)|racial makeup|(?:only |all )?(?:want )?(?:a )?(?:white|black|asian|hispanic|muslim|jewish) (?:neighborhood|area|community))\b/.test(text)) return "discrimination";
    if (/\b(fuck|shit|damn|crap|bullshit)\b/.test(text)) return "language";
    return null;
  }
  return { detectIntent: detectIntent, detectLocation: detectLocation, resolveOrigin: resolveOrigin, detectTenure: detectTenure, isUnclearAnswer: isUnclearAnswer, extractFirstName: extractFirstName, classifyMoveTiming: classifyMoveTiming, activeQuestions: activeQuestions, asksQuestion: asksQuestion, findFaq: findFaq, wantsResources: wantsResources, wantsBooking: wantsBooking, classifySafety: classifySafety };
});
