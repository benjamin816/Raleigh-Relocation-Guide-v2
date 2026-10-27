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
  function detectIntent(value, config) {
    var text = normalize(value);
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
  function wantsResources(value) { return /\b(resources?|guides?|articles?|blogs?|read|learn more|website|web page)\b/i.test(value); }
  function wantsBooking(value) { return /\b(book|booking|schedule|appointment|call|talk to (you|the team)|meet with)\b/i.test(value); }
  function classifySafety(value, previous) {
    var text = normalize(value);
    var links = (text.match(/(?:https?:\/\/|www\.)/g) || []).length;
    if (links >= 2 || /([^\s])\1{12,}/.test(text) || (previous && text === normalize(previous) && text.length > 60)) return "spam";
    if (/\b(kill|hurt|attack|threaten)\s+(you|your team|your agents)\b/.test(text) || /\b(fuck|screw)\s+(you|your team|your agents)\b/.test(text)) return "abuse";
    if (/\b(no (?:black|immigrant)|avoid (?:black|asian|hispanic|muslim|jewish|gay) (?:people|neighbors)|racial makeup|(?:only |all )?(?:want )?(?:a )?(?:white|black|asian|hispanic|muslim|jewish) (?:neighborhood|area|community))\b/.test(text)) return "discrimination";
    if (/\b(fuck|shit|damn|crap|bullshit)\b/.test(text)) return "language";
    return null;
  }
  return { detectIntent: detectIntent, findFaq: findFaq, wantsResources: wantsResources, wantsBooking: wantsBooking, classifySafety: classifySafety };
});
