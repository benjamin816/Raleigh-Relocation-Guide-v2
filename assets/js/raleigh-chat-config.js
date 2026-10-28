// Raleigh chat conversation configuration. Edit in tools/chat-flow-editor/.
window.RaleighChatConfig = {
  "title": "Welcome to Living in Raleigh",
  "avatar": "/assets/images/chat/raleigh-guide-avatar.png",
  "welcome": "Thanks for checking out the website! Are you looking to buy or sell real estate in the Raleigh area?",
  "conversationMemoryDays": 365,
  "fallback": "Tell me a little more about your goals - Are you looking to buy or sell real estate in the Raleigh area?",
  "contactPrompt": "I can pass your question to the team. I'll take a few details first so they can help you best...",
  "contactQuestions": [
    {
      "key": "name",
      "prompt": "What's your first and last name?",
      "retry": "Could you enter your name?"
    },
    {
      "key": "email",
      "prompt": "What's the best email address for you?",
      "retry": "That email doesn't look quite right. Could you try again?"
    },
    {
      "key": "phone",
      "prompt": "What phone number can our team reach you at?",
      "retry": "Could you enter a phone number with at least 10 digits?"
    },
    {
      "key": "question",
      "prompt": "What do you want the team to know? ",
      "retry": "Could you tell us a bit more about your question?"
    }
  ],
  "contactConsentPrompt": "May our team contact you about this question? Reply yes to submit your details, or no to cancel.",
  "bookingPrompt": "To put together a game plan for you, would a video or phone call work better?",
  "bookingChoicePrompt": "Would either of those work?",
  "bookingEmailPrompt": "What's the best email address for the invitation and everything you need before our call?",
  "bookingPhonePrompt": "And what's the best phone number to reach you?",
  "bookingNamePrompt": "What first and last name should I put on the invitation?",
  "bookingLinks": {
    "general": "/consult/",
    "investing": "/invest/"
  },
  "investorContactUrl": "/invest/resources",
  "investorConsoleUrl": "/invest/",
  "investorQuestionUrl": "/calculator/",
  "bookingBridgeUrl": "https://script.google.com/macros/s/AKfycbysLAettKRWslMW8YgG3BxftA2eBL_gsZFdK70bN7B3xu-aG_stqdNqg3jYBB5aqoMa2g/exec",
  "chatVideoBookingEnabled": true,
  "chatRoundRobinBookingEnabled": true,
  "chatAttachmentsEnabled": true,
  "leadEndpoint": "https://script.google.com/macros/s/AKfycbxqxF6Eq-pXzvYYTnAJvirB4bFAygnD6XkG51YWMC11mo0_2tsHoHCA6FK_N-mFskM/exec",
  "excludedPaths": [
    "/consult/",
    "/2026/"
  ],
  "topics": [
    {
      "id": "buying",
      "label": "Buying a home"
    },
    {
      "id": "selling",
      "label": "Selling a home"
    },
    {
      "id": "relocating",
      "label": "Relocating here"
    },
    {
      "id": "investing",
      "label": "Investing"
    }
  ],
  "flows": {
    "buying": {
      "keywords": [
        "buy",
        "buying",
        "buyer",
        "purchase",
        "home search",
        "looking for a home",
        "mortgage",
        "preapproved",
        "pre-approved"
      ],
      "intro": "Awesome.",
      "questions": [
        {
          "key": "location",
          "text": "Are you moving here from out of state, or are you already local?"
        },
        {
          "key": "currentArea",
          "when": "local",
          "text": "Where do you live right now?"
        },
        {
          "key": "tenure",
          "when": "local",
          "text": "Are you renting, or do you own your current home?"
        },
        {
          "key": "firstTime",
          "when": "renting",
          "text": "Will this be your first time buying a home?"
        },
        {
          "key": "leaseEnd",
          "when": "renting",
          "text": "When does your lease end?"
        },
        {
          "key": "willSell",
          "when": "owning",
          "text": "Will you need to sell your current home as part of this move?"
        },
        {
          "key": "whyRaleigh",
          "when": "out",
          "text": "What has you looking at moving to Raleigh?",
          "alternatives": [
            "What's drawing you to Raleigh?"
          ]
        },
        {
          "key": "familyNearby",
          "when": "family",
          "text": "Do you already have family or friends in the Raleigh area?"
        },
        {
          "key": "priorities",
          "when": "outNeedsPriorities",
          "text": "What matters most to you in the place where you'll live?"
        },
        {
          "key": "areas",
          "text": "Do you have certain areas around Raleigh you're most interested in?"
        },
        {
          "key": "areasReason",
          "when": "areaReasonNeeded",
          "text": "What was it about that area that stood out to you?"
        },
        {
          "key": "home",
          "text": "As far as the home goes, what's most important to you?"
        },
        {
          "key": "budget",
          "when": "budgetNeeded",
          "text": "And as far as price, where would you ideally like to be?"
        },
        {
          "key": "financing",
          "when": "budgetKnown",
          "text": "Do you think you'll be buying with cash or using financing?"
        },
        {
          "key": "timing",
          "text": "Lastly, when are you hoping to make the move, in an ideal world?"
        }
      ],
      "finish": "A one-on-one conversation with the team would help us build a game plan around your timing and what you're looking for.",
      "resourceLink": {
        "label": "Explore buying resources",
        "href": "/buy/"
      },
      "booking": "general"
    },
    "selling": {
      "keywords": [
        "sell",
        "selling",
        "seller",
        "list my",
        "list our",
        "home value",
        "valuation",
        "what is my home worth"
      ],
      "intro": "Awesome.",
      "questions": [
        {
          "key": "whySell",
          "when": "combined",
          "text": "What has you looking to sell your current home?"
        },
        {
          "key": "currentHome",
          "text": "Where is your current home?"
        },
        {
          "key": "ownedYears",
          "text": "How long have you owned it?"
        },
        {
          "key": "whySellSolo",
          "when": "solo",
          "text": "What has you looking to sell?"
        },
        {
          "key": "nextDestination",
          "text": "Where would you like to go next?"
        },
        {
          "key": "nextAreaReason",
          "when": "combined",
          "text": "What has you interested in that area?"
        },
        {
          "key": "nextHome",
          "when": "combined",
          "text": "What are you looking for in your next home that your current home doesn't have?"
        },
        {
          "key": "budget",
          "when": "combined",
          "text": "What's a comfortable price range for your next home?"
        },
        {
          "key": "sellingExperience",
          "text": "Would this be your first time selling a home, or have you sold before?"
        },
        {
          "key": "timing",
          "text": "When would you like to make that move?"
        }
      ],
      "finish": "The right plan depends on your current home, timing, and next move. Let's talk it through together.",
      "resourceLink": {
        "label": "Explore selling resources",
        "href": "/sell/"
      },
      "booking": "general",
      "combinedIntro": "Awesome. We work with a lot of people who are selling and buying here in Raleigh."
    },
    "relocating": {
      "keywords": [
        "relocat",
        "moving",
        "move to",
        "new to raleigh",
        "neighborhood",
        "suburb",
        "schools",
        "commute"
      ],
      "intro": "That's exciting.",
      "questions": [
        {
          "key": "location",
          "text": "Where are you moving from?"
        },
        {
          "key": "whyRaleigh",
          "when": "out",
          "text": "What has you looking at moving here?"
        },
        {
          "key": "familyNearby",
          "when": "family",
          "text": "Do you already have family or friends in the Raleigh area?"
        },
        {
          "key": "currentArea",
          "when": "local",
          "text": "Where do you live now?"
        },
        {
          "key": "tenure",
          "when": "local",
          "text": "Are you renting, or do you own your current home?"
        },
        {
          "key": "firstTime",
          "when": "renting",
          "text": "Will this be your first time buying a home?"
        },
        {
          "key": "leaseEnd",
          "when": "renting",
          "text": "When does your lease end?"
        },
        {
          "key": "willSell",
          "when": "owning",
          "text": "Will you need to sell your current home as part of this move?"
        },
        {
          "key": "priorities",
          "when": "outNeedsPriorities",
          "text": "What matters most to you in a place to live?"
        },
        {
          "key": "areas",
          "text": "Do you have certain areas around Raleigh you're most interested in?"
        },
        {
          "key": "areasReason",
          "when": "areaReasonNeeded",
          "text": "What was it about that area that stood out to you?"
        },
        {
          "key": "home",
          "text": "As far as the home goes, what's most important to you?"
        },
        {
          "key": "budget",
          "when": "budgetNeeded",
          "text": "And as far as price, where would you ideally like to be?"
        },
        {
          "key": "financing",
          "when": "budgetKnown",
          "text": "Do you think you'll be buying with cash or using financing?"
        },
        {
          "key": "timing",
          "text": "Lastly, when are you hoping to make the move, in an ideal world?"
        }
      ],
      "finish": "A one-on-one conversation with the team would help us build a game plan around your move and the areas you're considering.",
      "resourceLink": {
        "label": "Explore buying resources",
        "href": "/buy/"
      },
      "booking": "general"
    },
    "investing": {
      "keywords": [
        "invest",
        "rental",
        "cash flow",
        "cashflow",
        "airbnb",
        "short term",
        "short-term",
        "dscr",
        "cap rate"
      ],
      "intro": "Great. We work with many investors, both local and out of state.",
      "questions": [
        {
          "key": "location",
          "text": "Do you currently live here, or are you out of state?"
        },
        {
          "key": "experience",
          "text": "Would this be your first investment, or do you have experience investing?"
        },
        {
          "key": "strategy",
          "text": "What kind of investment are you looking for?"
        },
        {
          "key": "timing",
          "text": "Are you looking to invest this year, or do you have a different timeline in mind?"
        },
        {
          "key": "areas",
          "text": "Are there particular areas you're considering, or are you flexible on location?"
        },
        {
          "key": "goals",
          "text": "Are you more focused on cash flow, long-term growth, or a mix of both?"
        },
        {
          "key": "involvement",
          "text": "Are you looking for something hands-on, or would you prefer a more passive investment?"
        },
        {
          "key": "budget",
          "text": "What's a comfortable investment budget for you?"
        }
      ],
      "finish": "Our calculator is a useful first pass. For a property-specific strategy, book an investing exploration call.",
      "resourceLink": {
        "label": "Explore investing resources",
        "href": "/invest/resources/"
      },
      "booking": "investing",
      "secondaryLink": {
        "label": "Open investment calculator",
        "href": "/calculator/"
      }
    }
  },
  "faq": [
    {
      "keywords": [
        "where should i start",
        "first step",
        "how do i begin"
      ],
      "answer": "Start with your timing, budget, and what you need from a home or neighborhood. We can narrow the options from there."
    },
    {
      "keywords": [
        "down payment",
        "how much down"
      ],
      "answer": "The amount depends on the loan and your finances. A lender can give you a much more reliable number, and we can connect you with one of our trusted local lenders as part of the process."
    },
    {
      "keywords": [
        "preapproved",
        "pre-approved",
        "preapproval",
        "mortgage lender"
      ],
      "answer": "A lender's preapproval helps you understand your price range and makes an offer more practical. If you need a lender introduction, our team can help."
    },
    {
      "keywords": [
        "closing costs",
        "cost to buy"
      ],
      "answer": "Closing costs depend on the loan, property, and contract. Ask your lender for a written estimate before deciding what you can comfortably spend."
    },
    {
      "keywords": [
        "schools",
        "school district"
      ],
      "answer": "School assignments can change by address, so check the district's current address lookup for any home you're considering. We can help you compare areas using the criteria that matter to you."
    },
    {
      "keywords": [
        "commute",
        "traffic"
      ],
      "answer": "Commute times vary a lot by route and time of day. Tell me where you need to travel and what commute feels comfortable, and we can narrow the areas."
    },
    {
      "keywords": [
        "best neighborhood",
        "where should i live",
        "best suburb"
      ],
      "answer": "There isn't one best area for everyone. Budget, commute, home style, and daily life all matter. Tell me which of those matters most to you."
    },
    {
      "keywords": [
        "new construction",
        "builder"
      ],
      "answer": "New construction can offer different timelines and incentives, but the details vary by builder and community. We can help you compare it with resale homes."
    },
    {
      "keywords": [
        "home value",
        "what is my home worth",
        "price my house"
      ],
      "answer": "The price depends on your home's condition and recent comparable sales nearby. We can put together a local pricing review for your specific property."
    },
    {
      "keywords": [
        "cost to sell",
        "selling costs",
        "commission"
      ],
      "answer": "Selling costs depend on your agreement and the property. We can walk through an estimated net sheet once we know the home and your goals."
    },
    {
      "keywords": [
        "sell and buy",
        "selling and buying",
        "buy and sell"
      ],
      "answer": "We can plan the sale and next purchase together, including timing and where you want to go next."
    },
    {
      "keywords": [
        "investing resources",
        "investment resources",
        "rental resources"
      ],
      "answer": "Our Investing in Raleigh resources cover local strategies and market questions."
    },
    {
      "keywords": [
        "earnest money",
        "due diligence money"
      ],
      "answer": "Those amounts and deadlines depend on the offer and contract. We can explain the local process before you decide what to offer."
    },
    {
      "keywords": [
        "inspection",
        "home inspector"
      ],
      "answer": "An inspection can help you understand the home's condition before closing. We can talk through timing and what to do with the findings."
    },
    {
      "keywords": [
        "how long does closing take",
        "closing timeline"
      ],
      "answer": "The timeline depends on financing, the contract, and the property. Once we know your situation, we can map out realistic dates."
    },
    {
      "keywords": [
        "buy remotely",
        "out of state buyer",
        "virtual tour"
      ],
      "answer": "We often help people evaluate Raleigh homes from a distance with video walkthroughs and local context. Tell us where you're moving from and what you need to see."
    },
    {
      "keywords": [
        "hoa",
        "homeowners association"
      ],
      "answer": "HOA rules and fees vary by community. We can help you find the current documents for a home you're considering."
    },
    {
      "keywords": [
        "property taxes",
        "tax rate"
      ],
      "answer": "Property taxes vary by address and can change. Check the county's current assessment and tax information for a specific home; we can point you to the right records."
    },
    {
      "keywords": [
        "how fast are homes selling",
        "days on market"
      ],
      "answer": "Market pace varies by neighborhood, price, and condition. We can pull recent comparable sales for the area you care about."
    },
    {
      "keywords": [
        "should i rent or buy",
        "rent vs buy"
      ],
      "answer": "That depends on your timeline, budget, and flexibility. Tell me how long you expect to stay and what monthly payment feels comfortable."
    }
  ],
  "originAcknowledgements": {
    "ohio": "Awesome. We've worked with multiple families relocating from Ohio.",
    "new york": "That's awesome. We get a lot of people relocating from New York."
  },
  "safetyWarning": "Let's keep this focused on your real estate question. Are you looking to buy or sell in Raleigh?",
  "safetyEnd": "I'm going to end this conversation for now. Please reach out in the future if you're thinking about buying or selling in Raleigh.",
  "unknownQuestion": "That's a great question for our team. We can go through your specific questions on an exploration call."
};
