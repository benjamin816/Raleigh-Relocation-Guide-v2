// Edit this file to change the chat's wording, intents, questions, and links.
// The widget logic lives in raleigh-chat.js and should not need copy changes.
window.RaleighChatConfig = {
  title: "Ask us about Raleigh",
  avatar: "/assets/images/chat/raleigh-guide-avatar.png",
  welcome: "Thanks for stopping by! Are you looking to buy, sell, relocate, or invest in the Raleigh area?",
  fallback: "I can help you find the right next step. Choose a topic below, or tell me a little about what you have in mind.",
  contactPrompt: "Want a personal answer from our team? Share a few details and we'll help you take the next step.",
  bookingLinks: {
    general: "/consult/",
    investing: "/invest/"
  },
  // Existing website lead receiver. Chat submissions are identified by
  // source_key=website_rule_chat and appear in the Master Leads chat tab.
  leadEndpoint: "https://script.google.com/macros/s/AKfycbwnqkPb6Nkp9owlDv_orcAId7cNHbKuQrf5ENMW4BvbUuaLFNHP-yANDdSwQ6Vjl41v/exec",
  excludedPaths: ["/consult/", "/2026/"],
  topics: [
    { id: "buying", label: "Buying a home" },
    { id: "selling", label: "Selling a home" },
    { id: "relocating", label: "Relocating here" },
    { id: "investing", label: "Investing" }
  ],
  flows: {
    buying: {
      keywords: ["buy", "buyer", "purchase", "home search", "mortgage", "preapproved", "pre-approved"],
      intro: "Great. We can help you narrow the search to homes and areas that fit your life.",
      questions: [
        { text: "When are you hoping to buy?", choices: ["As soon as possible", "In 3–6 months", "In 6–12 months", "Just exploring"] },
        { text: "Which part of the Triangle interests you most?", choices: ["Raleigh", "Cary or Apex", "Wake Forest", "Still comparing"] }
      ],
      finish: "That gives us a good starting point. A one-on-one call is the best way to talk through homes, timing, and neighborhoods.",
      booking: "general"
    },
    selling: {
      keywords: ["sell", "selling", "seller", "list my", "home value", "valuation", "what is my home worth"],
      intro: "We can help you think through pricing, preparation, and the timing of a Raleigh-area sale.",
      questions: [
        { text: "When might you sell?", choices: ["Now", "In 3–6 months", "Later this year", "Just researching"] },
        { text: "Where is the property?", choices: ["Raleigh", "Cary or Apex", "Another Triangle area", "I'd rather type it"] }
      ],
      finish: "The right plan depends on the exact home and neighborhood. Let's talk through your goals and next steps.",
      booking: "general"
    },
    relocating: {
      keywords: ["relocat", "moving", "move to", "new to raleigh", "neighborhood", "suburb", "schools", "commute"],
      intro: "Welcome! The Triangle has very different neighborhoods and suburbs, so let's start with your day-to-day priorities.",
      questions: [
        { text: "What's most important in your move?", choices: ["Commute", "Schools", "Walkability", "Space and value"] },
        { text: "When do you expect to move?", choices: ["Soon", "In 3–6 months", "In 6–12 months", "Still planning"] }
      ],
      finish: "We can help you compare the areas in person rather than guessing from a map.",
      booking: "general"
    },
    investing: {
      keywords: ["invest", "rental", "cash flow", "cashflow", "airbnb", "short term", "short-term", "dscr", "cap rate"],
      intro: "Let's match the strategy to the property and numbers—not just a neighborhood name.",
      questions: [
        { text: "Which investing approach are you considering?", choices: ["Long-term rental", "Short-term rental", "By the room", "Still comparing"] },
        { text: "Where are you in the process?", choices: ["Ready to buy", "Researching deals", "Building a plan", "Already own rentals"] }
      ],
      finish: "Our calculator is a useful first pass. For a property-specific strategy, book an investing exploration call.",
      booking: "investing",
      secondaryLink: { label: "Open investment calculator", href: "/calculator/" }
    }
  }
};
