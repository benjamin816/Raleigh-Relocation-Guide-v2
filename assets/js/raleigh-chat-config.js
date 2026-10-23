// Edit this file to change the chat's wording, intents, questions, and links.
// The widget logic lives in raleigh-chat.js and should not need copy changes.
window.RaleighChatConfig = {
  title: "Welcome to Raleigh NC Guide",
  avatar: "/assets/images/chat/raleigh-guide-avatar.png",
  welcome: "Thanks for stopping by! Are you looking to buy, sell, relocate, or invest in the Raleigh area?",
  conversationMemoryDays: 180,
  fallback: "Tell me a little more about what you have in mind. Are you buying, selling, relocating, or investing? You can also type 'contact' to send our team a question.",
  contactPrompt: "I can pass your question to the team. I'll take a few details first.",
  contactQuestions: [
    { key: "name", prompt: "What's your name?", retry: "Could you enter your name?" },
    { key: "email", prompt: "What's the best email address for you?", retry: "That email doesn't look quite right. Could you try again?" },
    { key: "phone", prompt: "What phone number can our team reach you at?", retry: "Could you enter a phone number with at least 10 digits?" },
    { key: "question", prompt: "What's your question for the team?", retry: "Could you tell us a bit more about your question?" }
  ],
  contactConsentPrompt: "May our team contact you about this question? Reply yes to submit your details, or no to cancel.",
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
        { text: "When are you hoping to buy?" },
        { text: "Which part of the Triangle interests you most?" }
      ],
      finish: "That gives us a good starting point. A one-on-one call is the best way to talk through homes, timing, and neighborhoods.",
      booking: "general"
    },
    selling: {
      keywords: ["sell", "selling", "seller", "list my", "home value", "valuation", "what is my home worth"],
      intro: "We can help you think through pricing, preparation, and the timing of a Raleigh-area sale.",
      questions: [
        { text: "When might you sell?" },
        { text: "Where is the property?" }
      ],
      finish: "The right plan depends on the exact home and neighborhood. Let's talk through your goals and next steps.",
      booking: "general"
    },
    relocating: {
      keywords: ["relocat", "moving", "move to", "new to raleigh", "neighborhood", "suburb", "schools", "commute"],
      intro: "Welcome! The Triangle has very different neighborhoods and suburbs, so let's start with your day-to-day priorities.",
      questions: [
        { text: "What's most important in your move?" },
        { text: "When do you expect to move?" }
      ],
      finish: "We can help you compare the areas in person rather than guessing from a map.",
      booking: "general"
    },
    investing: {
      keywords: ["invest", "rental", "cash flow", "cashflow", "airbnb", "short term", "short-term", "dscr", "cap rate"],
      intro: "Let's match the strategy to the property and numbers—not just a neighborhood name.",
      questions: [
        { text: "Which investing approach are you considering?" },
        { text: "Where are you in the process?" }
      ],
      finish: "Our calculator is a useful first pass. For a property-specific strategy, book an investing exploration call.",
      booking: "investing",
      secondaryLink: { label: "Open investment calculator", href: "/calculator/" }
    }
  }
};
