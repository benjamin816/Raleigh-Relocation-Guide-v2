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
  var routingWords = ["moving", "buying", "selling", "relocating", "investing", "investment", "investments", "investor", "investors", "invest", "househack", "househacking", "renting", "rental", "purchase", "purchasing", "booking", "appointment", "schedule"];
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
    return normalize(value).replace(/\bsel(?=\s+(?:my|our|the|a|mom))/g, 'sell').replace(/\b[a-z]{5,}\b/g, function (word) {
      if (routingWords.indexOf(word) !== -1) return word;
      var matches = routingWords.filter(function (target) { return oneEditAway(word, target); });
      return matches.length === 1 ? matches[0] : word;
    });
  }
  function detectIntent(value, config) {
    var text = normalizeRouting(value).replace(/\b(?:not|no longer)\s+(?:an?\s+|interested in\s+|looking to\s+)?(?:invest(?:ing|ment|or)?|sell(?:ing)?|buy(?:ing)?)\b/g, '');
    var sell = /\b(sell|selling|seller|list my|listing my|home value|house value)\b/.test(text);
    var buy = /\b(buy|buying|buyer|purchase|purchasing|looking for a home)\b/.test(text);
    var investingText = text.replace(/\b(ltr|str|mtr|adu)s\b/g, '$1').replace(/\brentals\b/g, 'rental').replace(/\bhousehacks\b/g, 'househack').replace(/\bdwelling units\b/g, 'dwelling unit');
    if ((config.investingKeywords || []).some(function (term) { return hasPhrase(investingText, term); }) ||
        /\b(invest(?:ing|ment|or)?|rental property|airbnb|dscr|cash ?flow|cap rate|multifamily)\b/.test(text)) {
      return { id: "investing", combined: false };
    }
    var primary = text.match(/\b(?:main|primary) (?:goal|focus|priority) (?:is|will be)\s+(buy(?:ing)?|purchas(?:e|ing)|sell(?:ing)?)\b/);
    if (primary) return {id:/^sell/.test(primary[1])?'selling':'buying',combined:false};
    if (sell && buy) return { id: "selling", combined: true };
    if (/\b(?:house|home|property)\b.{0,30}\b(?:worth|value|valuation)\b/.test(text)) return {id:'selling',combined:false};
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
  function declinesScheduling(value) {
    var text = normalize(value);
    return /\b(?:don't|do not|not ready|may not be ready|might not be ready|rather not|prefer not|without)\s+(?:(?:want|wish|like|be|ready|to|any|a|for|ask me to)\s+)*(?:book(?:ing)?|schedul\w*|calls?|appointments?|talk|meet|speak)\b|\bno\s+(?:calls?|appointments?|scheduling|booking|meetings?)\b/i.test(text);
  }
  function declinesContact(value) {
    return /\b(?:don't|do not|rather not|prefer not|won't|will not|not comfortable)\s+(?:(?:want|to|with|ask|me|for|my|any|collect|share|sharing|provide|providing|give|giving|contact|personal)\s+)*(?:details|information|name|phone|email|contact)\b|\b(?:stay|remain) anonymous\b/i.test(value);
  }
  function researchOnly(value) {
    return /\b(?:only|just)\s+(?:gathering information|browsing|researching|looking for information)|\bnot ready to (?:buy|sell|list|invest)|\b(?:cannot|can't) agree (?:whether|if) to sell\b/i.test(value);
  }
  function explicitBooking(value) {
    return !declinesScheduling(value) && /^(?:yes[,!]?\s+)?(?:let's|can we|could we|can i|could i|i want to|i'd like to|i would like to|please|book|schedule|set up)\b.{0,50}\b(?:book|schedule|call|appointment|meeting)\b|^(?:book|schedule)(?: a call)?[.!?]*$|\bready to (?:book|schedule)\b/i.test(value);
  }
  function declinesName(value) { return /^(?:no|no thanks|nope|rather not|prefer not to|skip)[.!?]*$/i.test(String(value).trim()) || /\b(?:rather not|prefer not|don't want|do not want|not comfortable|stay anonymous|remain anonymous|skip (?:the |my )?name|don't ask for my name|do not ask for my name)\b/i.test(value); }
  function wantsBooking(value) {
    var text = normalizeRouting(value);
    if (declinesScheduling(text) || declinesContact(text) || researchOnly(text) || /\b(?:may|might)\s+(?:want|like|need)\b.{0,40}\b(?:contact|call|book|schedule)\b|\b(?:if|when)\s+(?:we|i)\s+(?:(?:ever|do)\s+)?(?:talk|meet|call|book)\b/.test(text)) return false;
    return /\b(book|booking|schedule|appointment|call|talk to (you|the team)|meet with)\b/i.test(text);
  }
  function rentalOnly(value) {
    var text = normalize(value);
    return /\b(?:only|just|solely)\s+(?:want (?:to |an? )?|looking (?:to |for an? )?|interested in\s+)?(?:rent(?:ing)?|(?:short.term )?rental|an? apartment)\b|\b(?:not buying or selling|neither.*rent)\b/.test(text) &&
      !/\b(?:invest|investment|investing|investor|landlord|rent (?:out|my)|buy.*rental|own.*rental)\b/.test(text);
  }
  function asksQuestion(value) { return /\?|^\s*(how|what|where|when|why|can|could|do|does|is|are|should|tell me|explain)\b/i.test(value); }
  function detectLocation(value, config) {
    var text = normalize(value);
    var barePlace = text.replace(/^[\s.,!?]+|[\s.,!?]+$/g, "");
    var localAreas = config && config.localAreas || ['Raleigh', 'Cary', 'Durham'];
    if (localAreas.some(function (area) { return normalize(area) === barePlace; })) return { type: 'local', place: '' };
    if (localAreas.some(function (area) { return new RegExp('\\b(?:live in|living in|rent in|renting in|already in|from)\\s+' + area.replace(/[-]/g, '[- ]') + '\\b', 'i').test(text); })) return { type: 'local', place: '' };
    if (/^(?:raleigh|cary|durham|the triangle|north carolina|nc)$/.test(barePlace)) return { type: "local", place: "" };
    if (config && Object.keys(config.originStates || {}).some(function (code) {
      return barePlace === code.toLowerCase() || barePlace === normalize(config.originStates[code]);
    })) return { type: "out", place: barePlace };
    if (config && Object.keys(config.originCities || {}).some(function (code) {
      return (config.originCities[code] || []).some(function (city) { return barePlace === normalize(city); });
    })) return { type: "out", place: barePlace };
    if (/\b(already (?:live|living|here|local)|(?:i (?:live|am living|am)|i'm) (?:here|in (?:(?:north|south|east|west) )?(?:raleigh|cary|durham|the triangle))|i'm local|i am local|from (?:raleigh|cary|durham))\b/.test(text)) return { type: "local", place: "" };
    var from = text.match(/\b(?:from|live in|living in|rent in|renting in|retired in|moving from|relocating from|i am in|i'm in|we are in)\s+([a-z][a-z .-]{1,35}?)(?=\s*(?:,|\.|!|\?|[—–]|$|\s+(?:and|because|but|to|for|in\s+\d+|within)\b))/);
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
    if (location.stateCode && states[location.stateCode]) return {type:'out',place:states[location.stateCode].toLowerCase(),stateCode:location.stateCode,city:location.city || ''};
    var codes = Object.keys(states);
    var stateCode = codes.find(function (code) {
      return raw === code.toLowerCase() || raw === normalize(states[code]);
    });
    if (stateCode) return { type: "out", place: states[stateCode].toLowerCase(), stateCode: stateCode, city: "" };
    var namedState = codes.find(function (code) { return raw.endsWith(', ' + normalize(states[code])); });
    if (namedState) return { type: 'out', place: states[namedState].toLowerCase(), stateCode: namedState, city: raw.slice(0, -(states[namedState].length + 2)) };
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
  function isSensitiveFamilyReason(value) {
    return /\b(?:unwell|sick(?:ness)?|ill(?:ness)?|health (?:issue|problem)s?|cancer|terminal(?:ly)?(?:\s+ill)?|dying|death|died|passed away|hospice|hospitalized|hospitalised|caregiving|care for (?:my|our) (?:mom|mother|dad|father|parent))\b/i.test(value);
  }
  function classifyMoveTiming(value, now) {
    var text = normalize(value);
    if (/\b(?:not now|not soon|not sure|don't know)\b/.test(text)) return "";
    var words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1 };
    var relative = text.match(/\b(?:in|within|about|around|roughly|approximately)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a couple(?: of)?|a few|an?)\s*(days?|weeks?|months?|years?)\b/);
    if (relative) {
      var amount = /^a couple/.test(relative[1]) ? 2 : relative[1] === "a few" ? 3 : (words[relative[1]] || Number(relative[1]));
      var unit = relative[2];
      return amount <= (unit.indexOf("day") === 0 ? 92 : unit.indexOf("week") === 0 ? 13 : unit.indexOf('year') === 0 ? .25 : 3) ? 'soon' : '';
    }
    if (/\b(now|asap|immediately|right away|this week|next week|this month|next month|soon)\b/.test(text)) return "soon";
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
  // Capture only explicit statements, never infer a home budget from beds,
  // a destination from relatives' addresses, or an investment from renting.
  function extractFacts(value, config, intent, questionKey) {
    var text = String(value || ''), lower = normalizeRouting(text), facts = {}, match;
    var location = detectLocation(text, config);
    var correctedOrigin = text.match(/\b(?:i|we) meant\s+([a-z][a-z ,.-]{1,55}?)(?=[—–.!?;]|$|\s+(?:to buy|to sell|and|for)\b)/i);
    if (correctedOrigin) location = resolveOrigin({type:'out',place:correctedOrigin[1].trim()},config);
    if (location && (questionKey === 'location' || correctedOrigin || /\b(?:from|live|living|local|out of state|rent(?:ing)? in|retired in|i am in|i'm in)\b/i.test(text))) facts.location = resolveOrigin(location, config);
    var leaseCity = text.match(/\b(?:our|my)\s+([a-z]+(?:\s+[a-z]+)?)\s+lease\b/i);
    if (!facts.location && leaseCity) {
      var leaseOrigin = resolveOrigin({type:'out',place:leaseCity[1]},config);
      if (leaseOrigin.stateCode) facts.location = leaseOrigin;
    }
    var leaseEnd = text.match(/\blease (?:ends|expires|is up)\s+(?:in |on )?(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2})?\b/i);
    if (leaseEnd) facts.leaseEnd = leaseEnd[0];
    if (questionKey === 'location' && (config.localAreas || []).some(function (area) { return normalize(area) === normalize(text).replace(/[.!?]+$/, ''); })) facts.currentArea = text;
    var tenancy = text.match(/\b(?:i|we)(?:'re|'m| are| am)?\s+(?:currently )?(rent(?:ing)?|own(?:ing)?)\b/i);
    if (tenancy) {
      if (location && location.type === 'out') facts.originHousing = tenancy[0];
      else facts.tenure = tenancy[1];
    }
    var areas = '(?:North Raleigh|South Raleigh|Raleigh|Cary|Apex|Durham|Wake Forest|Holly Springs|Fuquay[- ]Varina|Garner|Knightdale|Wendell|Zebulon|Rolesville|Morrisville|Chapel Hill|Clayton)';
    match = text.match(new RegExp('(?:live|living|rent|renting|already|local)\\s+(?:here\\s+)?in\\s+(' + areas + ')\\b', 'i'));
    if (match) { facts.currentArea = match[1]; facts.location = { type: 'local', place: '' }; }
    if (intent === 'selling' || /\b(?:sell|selling|seller|list)\b/.test(lower)) {
      match = text.match(new RegExp('(?:home|house|townhome|townhouse|duplex|condo|rental)\\s+(?:is\\s+)?in\\s+(' + areas + ')\\b', 'i'));
      if (match) facts.currentHome = match[1];
      if (!match) {
        match = text.match(new RegExp('(' + areas + ')\\s+(?:home|house|townhome|townhouse|duplex|condo)\\b', 'i'));
        if (match) facts.currentHome = match[1];
      }
      match = text.match(/\b(?:owned (?:it|the home|the house)?\s*(?:for)?|been there (?:for)?)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/i);
      if (match) facts.ownedYears = match[0];
      if (!match) { match = text.match(/\bafter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/i); if (match) facts.ownedYears = match[0]; }
      if (/\bfirst[- ]time sell(?:er|ing)|first (?:home )?sale|never sold\b/i.test(text)) facts.sellingExperience = 'First time selling';
      else if (/\b(?:sold before|prior sale experience|sold (?:a |\d+ )?(?:home|house)s? before)\b/i.test(text)) facts.sellingExperience = 'Has sold before';
    }
    var prices = text.match(/\$\s*\d[\d,]*(?:\.\d+)?\s*(?:k|m|million|thousand)?\b|\b\d+(?:\.\d+)?\s*(?:k|million|thousand)\b/ig);
    if (prices && (!asksQuestion(text) || /\b(?:my|our) budget|budget is|comfort.{0,20}(?:is|at)\b/i.test(text))) facts.budget = prices[prices.length - 1]; // Last explicit correction wins.
    match = text.match(/\b(?:in|within|about|around|roughly|maybe|probly)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a couple(?: of)?|a few|an?)\s+(?:days?|weeks?|months?|years?|mos)\b|\b(?:next|this)\s+(?:year|spring|summer|fall|autumn|winter)\b|\b(?:\d+|one|two|three|eight|eleven)\s+(?:months?|years?)\s+from now\b/i);
    if (match) facts.timing = match[0];
    if (/\b(?:first[- ]time buyer|first (?:home|townhouse|condo|house)|never (?:bought|owned))\b/i.test(text)) facts.firstTime = 'First home purchase';
    if (/\b(?:cash buyer|all[- ]cash|buy(?:ing)? (?:in|with) cash|cash budget)\b/i.test(text)) facts.financing = 'Cash';
    else if (/\b(?:using financing|using a mortgage|need a mortgage|financing the purchase)\b/i.test(text)) facts.financing = 'Financing';
    if (/\b(?:first investment|never invested|first rental investment|new to investing)\b/i.test(text)) facts.experience = 'First investment';
    else {
      match = text.match(/\b(?:invested for \d+ years?|\d+ (?:existing )?(?:(?:long|short|mid|medium)[- ]term )?rentals?|(?:two|three|four) (?:existing )?(?:(?:long|short|mid|medium)[- ]term )?rentals?)\b/i);
      if (match) facts.experience = match[0];
      else { match = text.match(/\bown\s+(?:\d+|one|two|three|four)\s+(?:LTRs?|STRs?|MTRs?|Airbnbs?)\b/i); if (match) facts.experience = match[0]; }
    }
    var strategies = text.match(/\b(?:LTRs?|STRs?|MTRs?|(?:long|short|mid|medium)[- ]term (?:rental|single[- ]family)|house[- ]?hack(?:ing)?|ADU|Airbnb|BRRRR|fix[- ]and[- ]flip|1031 exchange)\b/ig);
    if (strategies) facts.strategy = strategies[strategies.length - 1];
    if (/\bsell(?:ing)?\b.{0,35}\brental\b/i.test(text)) { facts.investmentSale = text; facts.experience = facts.experience || 'Selling an existing rental'; }
    if (/\bcash[- ]?flow|\bappreciation\b/i.test(text)) facts.goals = text;
    if (/\blow[- ]maintenance|\bpassive|\bhands[- ]on\b/i.test(text)) facts.involvement = text;
    var motivation = text.match(/\b(?:for|because of|cuz|after)\s+(?:(?:my|our|a|the|my partner's|medical)\s+)*(?:job|work|training|family|retirement)[^.!?;]*/i) || text.match(/\b(?:because|cuz)\s+[^.!?;]+/i);
    if (!motivation) motivation = text.match(/\b(?:my|our)\s+(?:(?:partner|spouse)'?s?\s+)?(?:got|accepted|started)\s+(?:a )?job[^.!?;]*/i);
    if (motivation) {
      facts.whyRaleigh = motivation[0];
      if (intent === 'selling' || /\bsell/.test(lower)) facts.whySell = facts.whySellSolo = motivation[0];
    }
    if (/\bdownsiz(?:e|ing)|\bretire(?:ment)?\b/i.test(text) && (intent === 'selling' || /\bsell/.test(lower))) facts.whySell = facts.whySellSolo = text;
    if (/\b(?:better weather|warmer weather|milder winters|closer to family|near family)\b/i.test(text)) facts.whyRaleigh = text;
    match = text.match(/\b(?:job|work|working|training)\s+(?:in|at|for)\s+([a-z][a-z .-]{1,45}?)(?=,|[.!?;]|$|\s+(?:and|in \d|starting)\b)/i);
    if (match) {
      facts.jobLocation = match[1];
      if (intent === 'selling') facts.nextDestination = match[1];
    }
    match = text.match(/\b(?:commut(?:e|ing).{0,35}?\bto|commut(?:e|ing)\s+(?:to|into))\s+([a-z][a-z .-]{1,45}?)(?=,|[.!?;]|$|\s+(?:and|under|within)\b)/i);
    if (match) facts.commuteDestination = match[1];
    if (/\bcommut(?:e|ing)\b/i.test(text) && /\b(?:under|within|less than|at most|max(?:imum)?)\s*\d+\s*(?:minutes?|mins?)\b/i.test(text)) facts.commuteRange = text;
    var home = text.match(/\b(?:(?:\d+|one|two|three|four|five|six)[- ]?(?:bed(?:room)?s?|bath(?:room)?s?)|(?:large|dog[- ]friendly|fenced) (?:back)?yard|single[- ]story|one[- ]level|step[- ]free entry|townhouse|ranch)\b/ig);
    if (home && (/\b(?:want|need|looking for|prefer|require|we'd like)\b/i.test(text) || /^(?:home|homeMore|priorities|priorityMore|areasReason|nextHome)$/.test(questionKey || '')) && !/\b(?:sell|selling) my\b/i.test(text)) facts.home = home.join(', ');
    match = text.match(new RegExp('(?:buy(?:ing)?|purchase|looking)\\s+(?:a home\\s+|a place\\s+|new construction\\s+)?(?:near|in)\\s+(' + areas + ')\\b', 'i'));
    if (match) facts.areas = match[1];
    if (!match) { match = text.match(new RegExp('\\b(?:buy|purchase)\\b.{0,35}?\\b(?:in|near)\\s+(' + areas + ')\\b','i')); if (match) facts.areas = match[1]; }
    return facts;
  }
  function activeQuestions(flow, profile, combined) {
    return (flow && flow.questions || []).filter(function (question) {
      switch (question.when || "always") {
        case 'investmentSale': return profile.investmentSale === true;
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
    if (/^(?:brrrr|dscr|ltr|str|mtr|adu)s?$/.test(text)) return null;
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
  return { declinesContact: declinesContact, researchOnly: researchOnly, explicitBooking: explicitBooking, extractFacts: extractFacts, declinesScheduling: declinesScheduling, declinesName: declinesName, rentalOnly: rentalOnly, detectIntent: detectIntent, detectLocation: detectLocation, resolveOrigin: resolveOrigin, detectTenure: detectTenure, isUnclearAnswer: isUnclearAnswer, extractFirstName: extractFirstName, isSensitiveFamilyReason: isSensitiveFamilyReason, classifyMoveTiming: classifyMoveTiming, activeQuestions: activeQuestions, asksQuestion: asksQuestion, findFaq: findFaq, wantsResources: wantsResources, wantsBooking: wantsBooking, classifySafety: classifySafety };
});
