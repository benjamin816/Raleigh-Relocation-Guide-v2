// Raleigh chat conversation configuration. Update through the TEST branch chat workflow.
window.RaleighChatConfig = {
  "rentalConversation": {
    "qualifier": "Got it. A lot of relocators do the same thing so they can test out the area first. Is your plan to rent for a few months while you search for a permanent home, or do you plan to rent for the next 12-plus months?",
    "services": "Our market doesn't have a system set up for us to work directly with renters. Most of our rentals don't go through the MLS. We do, however, offer free resources here on our website, plus our Living in Raleigh YouTube channel, to help you find the right area. We absolutely welcome you to reach back out when you're starting to look for a more permanent home.",
    "clarify": "Would you expect to rent for three months or less while looking for a home to buy, or for six to twelve months or longer? It's okay if you haven't decided yet.",
    "short": "That makes sense! Let's set up an exploration call with the team to build a game plan for renting briefly and finding your permanent home."
},
  "sellerReferral": {
    "intro": "We can't work directly with rentals, but our free website resources and Living in Raleigh YouTube channel can help you find the right area. We also have an extensive network of trusted listing agents in {market} and would be happy to help connect you with the right person.",
    "invitation": "Let's set up a quick 10\u201315-minute phone call with the team to learn more about your current home and help connect you with the right listing agent.",
    "resourceLabel": "Explore Raleigh guides",
    "resourceUrl": "/learning-center/",
    "notesLabel": "Out-of-state listing-agent referral; client plans to rent in Raleigh."
},
  "conversationResponses": {
    "uncertainTimeline": "No worries! Many people who reach out to us are still in that exploration phase. In an ideal world, would that move be sometime this year or next?",
    "researchTimeline": "Got it! What we offer clients in your shoes, being further out or still figuring out the timing, is an exploration call with the team to answer your burning questions and get you all the resources you need while you're still in that research phase.",
    "uncertainFunding": "No worries! We have a lot of clients who could lean either way. Some new-construction buyers, for example, may qualify for a lower-rate financing offer and prefer to keep their cash. We'll go over the pros and cons when we meet with you.",
    "fundingTimelineLead": "Last question real quick: when are you hoping to make the move, in an ideal world?"
},
  "informationalAnswers": [
    {
      "pattern": "\\bHOA\\b",
      "answer": "For an HOA property, compare the current dues, what they cover, planned increases or assessments, reserves, and the rules that matter to you. Ask for the current governing documents and available financial and meeting records for the specific community; a listing summary alone is not the complete picture."
    },
    {
      "pattern": "\\b(?:repairs?|as[- ]is|over[- ]?improv\\w*|prepar\\w*)\\b.{0,90}\\b(?:sell|sale|list|decid)|\\b(?:sell|sale|list)\\w*\\b.{0,90}\\b(?:repairs?|as[- ]is|prepar\\w*)",
      "answer": "Before spending on repairs, separate safety or maintenance problems from cosmetic upgrades. Gather repair estimates and compare the likely selling options, including selling as-is. You do not need to commit to renovations just to start gathering information. The right preparation depends on the property, your timing, and what buyers would be comparing it with."
    },
    {
      "pattern": "\\b(?:lender|loan officer)\\b.{0,65}\\b(?:do|role|job|explain|cost)|\\b(?:what|how)\\b.{0,50}\\b(?:closing costs?|lender)\\b",
      "answer": "A lender reviews your finances, explains loan options, and provides estimates of payments, cash needed, and closing costs. Ask the lender which costs would be paid upfront and whether any can be financed under the specific loan. This chat cannot determine approval, exact down payment, or loan terms."
    },
    {
      "pattern": "\\b(?:first[- ]time buyer|buyer)\\b.{0,55}\\b(?:do|before looking)|\\bbuying process\\b",
      "answer": "Before viewing homes, set a comfortable total budget, speak with a lender if you will finance, and separate your must-haves from preferences. Then compare areas and homes, review an offer and its deadlines with your team, arrange the appropriate inspections, and prepare for closing. You can learn about these steps before committing to a purchase."
    },
    {
      "pattern": "\\b(?:coordinat\\w*|two closings|sell first|buy.*sell|sell.*buy)\\b.{0,80}\\b(?:closings?|process|work)|\\bclosings?\\b.{0,50}\\b(?:coordinat\\w*|two)\\b",
      "answer": "A coordinated sale and purchase starts with matching the timelines, funding needs, and contract deadlines. The team can help compare approaches such as buying after the sale closes or using temporary housing between homes. Your lender and closing attorney need to confirm the financing and closing arrangements; do not assume both transactions must close at exactly the same time."
    },
    {
      "pattern": "\\b(?:how long|length|duration)\\b.{0,50}\\b(?:call|meeting|consult)\\b",
      "answer": "Our exploration-call appointments are scheduled for 60 minutes. You can use that time to discuss your goals, timing, areas, and questions with the team."
    },
    {
      "pattern": "\\b(?:valuation|comparable sales|determine.*price|pricing.*house|price.*comparable)\\b",
      "answer": "A valuation compares recent closed sales of similar homes, then considers location, size, layout, condition, and features. Current competing listings and your timing also matter. This chat can explain the process but cannot provide a reliable property-specific value."
    },
    {
      "pattern": "\\b(?:accessib\\w*|wheelchair|step[- ]free|mobility)\\b",
      "answer": "For accessibility, compare the actual entry route, steps, doorway widths, bathroom layout, bedroom access, and any elevator or single-level needs. Listing labels alone may not tell you whether a home works for you. Write down the measurements and features you need so those can be checked on each property."
    },
    {
      "pattern": "\\b(?:fixer|renovat\\w*|inspection|inspectors?|builder|new construction)\\b.{0,90}\\b(?:check|questions?|ask|compare|process|inspection|before|should|important)|\\b(?:what|how|which)\\b.{0,70}\\b(?:fixer|inspection|builder|new construction)\\b",
      "answer": "For a fixer, start with the condition of major systems, repair scope, contractor estimates, and your contingency budget. For new construction, compare what is included, upgrade costs, contract terms, timing, warranties, and inspection opportunities. Ask an independent inspector about the appropriate checks for the specific property; I cannot assess a home's condition from chat."
    },
    {
      "pattern": "\\b(?:valuation|value|worth|pricing|price)\\b.{0,65}\\b(?:process|determine|estimate|decide|calculate|compare)|\\b(?:how|what)\\b.{0,65}\\b(?:valuation|worth|price (?:a|my|our)|home value)\\b",
      "answer": "A valuation compares recent closed sales of similar homes, then looks at differences in location, size, layout, condition, and features. Current competing listings and your timing also matter. An online estimate is a starting point; this chat cannot provide a reliable property-specific value."
    },
    {
      "pattern": "\\b(?:records?|documents?|paperwork|maintenance information|preliminary steps)\\b",
      "answer": "You can start with ownership and loan documents, any survey, repair and maintenance records, permits, warranties, and HOA documents if applicable. For a rental, also gather leases, rent and deposit records, and income and expense records. You can organize these without committing to a sale. Your CPA or closing attorney can tell you what is needed for your particular situation."
    },
    {
      "pattern": "\\b(?:neutral|objective|framework|checklist|compar(?:e|ing|ison)|tradeoffs?)\\b.{0,90}\\b(?:areas?|places?|commute|price|cost|housing|parks?|grocer|neighborhood)|\\b(?:areas?|places?)\\b.{0,60}\\b(?:compar|criteria)\\w*",
      "answer": "A useful neutral comparison starts with your total housing budget, the home types available, routes to work, and access to parks, groceries, and other amenities you use. Compare the same criteria for each area; try your commute at the times you would actually travel, and check the specific property's taxes, insurance, HOA fees, and maintenance needs. I can help you build that checklist without scheduling a call."
    },
    {
      "pattern": "\\b(?:inherit(?:ed|ance)?|siblings?|estate|probate)\\b.{0,100}\\b(?:steps?|process|decid|sell|agree)|\\b(?:steps?|process)\\b.{0,60}\\b(?:inherit|estate|probate)",
      "answer": "While you decide, gather the ownership documents and maintenance records, keep the property maintained, and write down each owner's goals and questions. An estate or closing attorney can clarify who has authority to sell and what approvals may be needed. You can gather information and compare options without agreeing to list the home."
    },
    {
      "pattern": "\\b(?:sell|selling|sale|seller|list|listing)\\b.{0,70}\\b(?:process|steps?|prepare|preparation|costs?|fees)|\\b(?:process|steps?|prepare|preparation|costs?|fees)\\b.{0,70}\\b(?:sell|selling|sale|seller|list)",
      "answer": "A sale usually starts with reviewing the property and your timing, comparing recent sales, and deciding what preparation makes sense. Then come pricing, listing, showings, reviewing offers, and the contract-to-closing steps. For costs, compare an itemized estimate that includes any agreed service fees, repairs or concessions, loan payoff, and closing expenses; the amounts depend on the property and agreement."
    },
    {
      "pattern": "\\b(?:buy|buying|purchase|buyer)\\b.{0,65}\\b(?:process|steps?|prepare|costs?|fees)|\\b(?:process|steps?|costs?|fees)\\b.{0,65}\\b(?:buy|buying|purchase|buyer)",
      "answer": "For a purchase, start with a comfortable total budget and financing or proof of funds, then narrow the location and home features. Next come the search, an offer, inspections and other contract deadlines, and closing. Ask for an itemized estimate of purchase and ongoing costs so you can compare homes on more than the asking price."
    },
    {
      "pattern": "\\b(?:resources?|guides?|learn more|where can i read|website)\\b",
      "answer": "Yes—our site has buying and relocation resources at /buy/, selling resources at /sell/, and investing resources at /invest/resources/. Which topic would be most useful to you?"
    },
    {
      "pattern": "\\b(?:before|during|on|what happens|what.*expect)\\b.{0,65}\\b(?:call|meeting|consult)|\\b(?:call|meeting|consult)\\b.{0,60}\\b(?:prepare|involve|work|expect)",
      "answer": "An exploration call is a chance to explain your goals, ask questions, and talk through timing and possible next steps with the team. You can keep it focused on the real estate logistics and do not need to discuss private personal circumstances."
    }
  ],
  "title": "Welcome to Living in Raleigh",
  "avatar": "/assets/images/chat/raleigh-guide-avatar.png",
  "welcome": "Thanks for checking out the website! Are you looking to buy or sell real estate in the Raleigh area?",
  "conversationMemoryDays": 365,
  "localAreas": ["Raleigh", "North Raleigh", "Cary", "Apex", "Durham", "Wake Forest", "Holly Springs", "Fuquay-Varina", "Garner", "Knightdale", "Wendell", "Zebulon", "Rolesville", "Morrisville", "Chapel Hill", "Clayton"],
  "investingKeywords": [
    "invest", "investing", "investment", "investments", "investor", "investors",
    "LTR", "STR", "MTR", "long-term rental", "long term rental", "longterm rental",
    "short-term rental", "short term rental", "shortterm rental", "medium-term rental",
    "medium term rental", "mid-term rental", "mid term rental", "midterm rental",
    "house hack", "househack", "house hacking", "househacking", "house-hack", "house-hacking",
    "ADU", "accessory dwelling unit", "rental property", "rental properties", "rental investment",
    "buy and hold", "buy-and-hold", "BRRRR", "fix and flip", "fix-and-flip", "flipping houses",
    "Airbnb", "VRBO", "DSCR", "cash flow", "cashflow", "cap rate", "multifamily", "multi-family",
    "1031 exchange", "investment exchange", "rental portfolio", "as a rental", "as rental", "rental income", "become a landlord"
  ],
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
  "bookingChoicePrompt": "Which time works for you?",
  "benjaminDirectPhone": "919-737-7896",
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
  "bookingRelayUrl": "https://lir-booking-bridge.benjamin-raleighrealtor.workers.dev/booking",
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
          "when": "familyBeforePriorities",
          "text": "Do you already have family or friends in the Raleigh area?"
        },
        {
          "key": "priorities",
          "when": "outNeedsPriorities",
          "text": "When it comes to the area you choose to live in, what's most important to you?"
        },
        {
          "key": "priorityFamilyArea",
          "when": "familyAreaNeeded",
          "text": "What part of the Raleigh area is your family in?"
        },
        {
          "key": "priorityMore",
          "when": "prioritySingle",
          "text": "Is there anything else that's super important to you about the area, like nearby amenities, shopping, schools, or your commute?"
        },
        {
          "key": "commuteDestination",
          "when": "commuteDestinationNeeded",
          "text": "Do you know where you'll be commuting to once you make the move?"
        },
        {
          "key": "commuteRange",
          "when": "commuteRangeNeeded",
          "text": "And what's your comfort level for the commute? What's the farthest you'd be willing to drive, and what would be ideal?"
        },
        {
          "key": "priorityBudget",
          "when": "priorityPrice",
          "text": "What is your comfort level on the price of your new home?"
        },
        {
          "key": "priorityFinancing",
          "when": "priorityFinancingNeeded",
          "text": "Are you planning to buy your next home in cash, or are you going to be using financing?"
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
          "key": "homeMore",
          "when": "homeSingle",
          "text": "Is there anything else you'd want in the home, like a certain number of bedrooms or bathrooms, square footage, yard size, or a one- or two-story layout?"
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
          "key": "preapproval",
          "when": "needsPreapproval",
          "text": "Are you already pre-approved with a lender? If not, part of our process is connecting you with a trusted local lender we work with closely."
        },
        {
          "key": "timing",
          "text": "Lastly, when are you hoping to make the move, in an ideal world?"
        },
        {
          "key": "timingReason",
          "when": "shortTiming",
          "text": "What's important to you about that timeline?"
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
        },
        {
          "key": "timingReason",
          "when": "shortTiming",
          "text": "What's important to you about that timeline?"
        }
      ],
      "finish": "Even if your move is a little way off, an exploration call with our team can help you make a game plan for selling and finding your next home.",
      "finishNextSummer": "Totally get it. Typically, late spring into early summer is the best time to list, and you'll also have the most options on the buy side. Even with you targeting next summer, we should start putting together a game plan on an exploration call with our team. We can go over the timing and make sure the transition into your next home is as smooth as possible.",
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
      "intro": "Awesome",
      "questions": [
        {
          "key": "location",
          "text": "Where are you moving from?"
        },
        {
          "key": "moveGoal",
          "when": "local",
          "text": "Are you looking to buy a home here, sell a home here, or both?"
        },
        {
          "key": "whyRaleigh",
          "when": "out",
          "text": "What has you looking at moving here?"
        },
        {
          "key": "jobLocation",
          "when": "newJob",
          "text": "Where will you be working here?"
        },
        {
          "key": "jobStart",
          "when": "newJob",
          "text": "Do you have a start date for that job?"
        },
        {
          "key": "familyNearby",
          "when": "familyBeforePriorities",
          "text": "What part of the Raleigh area are they in?"
        },
        {
          "key": "originHousing",
          "when": "out",
          "text": "Do you have a home there that you'd need to sell, or are you currently renting?"
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
          "text": "When it comes to the area you choose to live in, what's most important to you?"
        },
        {
          "key": "priorityFamilyArea",
          "when": "familyAreaNeeded",
          "text": "What part of the Raleigh area is your family in?"
        },
        {
          "key": "priorityMore",
          "when": "prioritySingle",
          "text": "Is there anything else that's super important to you about the area, like nearby amenities, shopping, schools, or your commute?"
        },
        {
          "key": "commuteDestination",
          "when": "commuteDestinationNeeded",
          "text": "Do you know where you'll be commuting to once you make the move?"
        },
        {
          "key": "commuteRange",
          "when": "commuteRangeNeeded",
          "text": "And what's your comfort level for the commute? What's the farthest you'd be willing to drive, and what would be ideal?"
        },
        {
          "key": "priorityBudget",
          "when": "priorityPrice",
          "text": "What is your comfort level on the price of your new home?"
        },
        {
          "key": "priorityFinancing",
          "when": "priorityFinancingNeeded",
          "text": "Are you planning to buy your next home in cash, or are you going to be using financing?"
        },
        {
          "key": "areas",
          "text": "Do you have certain areas around Raleigh you're most interested in?"
        },
        {
          "key": "rentalPlan",
          "when": "rentalClarificationNeeded",
          "text": "Are you thinking of renting for a few months while you look for a permanent home, or are you only interested in renting?"
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
          "key": "homeMore",
          "when": "homeSingle",
          "text": "Is there anything else you'd want in the home, like a certain number of bedrooms or bathrooms, square footage, yard size, or a one- or two-story layout?"
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
          "key": "preapproval",
          "when": "needsPreapproval",
          "text": "Are you already pre-approved with a lender? If not, part of our process is connecting you with a trusted local lender we work with closely."
        },
        {
          "key": "timing",
          "text": "Lastly, when are you hoping to make the move, in an ideal world?"
        },
        {
          "key": "timingReason",
          "when": "shortTiming",
          "text": "What's important to you about that timeline?"
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
          "key": "salePriority",
          "when": "investmentSale",
          "text": "Should we focus on selling your current rental, the next investment, or planning both together?"
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
  "originStates": {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "DC": "Washington, DC"
  },
  "originCities": {
    "AL": ["Birmingham", "Huntsville", "Mobile"],
    "AK": ["Anchorage", "Fairbanks"],
    "AZ": ["Phoenix", "Tucson", "Mesa"],
    "AR": ["Little Rock", "Fayetteville"],
    "CA": ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "San Jose", "Oakland", "Fresno"],
    "CO": ["Denver", "Colorado Springs", "Boulder", "Aurora"],
    "CT": ["Hartford", "New Haven", "Stamford"],
    "DE": ["Wilmington", "Dover"],
    "FL": ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "St. Petersburg", "Naples"],
    "GA": ["Atlanta", "Savannah", "Augusta"],
    "HI": ["Honolulu", "Hilo"],
    "ID": ["Boise", "Idaho Falls", "Coeur d'Alene"],
    "IL": ["Chicago", "Naperville", "Peoria"],
    "IN": ["Indianapolis", "Fort Wayne", "Bloomington"],
    "IA": ["Des Moines", "Cedar Rapids", "Iowa City"],
    "KS": ["Wichita", "Overland Park", "Topeka"],
    "KY": ["Louisville", "Lexington", "Bowling Green"],
    "LA": ["New Orleans", "Baton Rouge", "Lafayette"],
    "ME": ["Portland", "Bangor"],
    "MD": ["Baltimore", "Annapolis", "Frederick"],
    "MA": ["Boston", "Cambridge", "Worcester"],
    "MI": ["Detroit", "Grand Rapids", "Ann Arbor"],
    "MN": ["Minneapolis", "St. Paul", "Duluth"],
    "MS": ["Jackson", "Biloxi", "Gulfport"],
    "MO": ["St. Louis", "Kansas City", "Springfield", "Columbia"],
    "MT": ["Billings", "Missoula", "Bozeman"],
    "NE": ["Omaha", "Lincoln", "Grand Island"],
    "NV": ["Las Vegas", "Reno", "Henderson"],
    "NH": ["Manchester", "Nashua", "Concord"],
    "NJ": ["Newark", "Jersey City", "Trenton", "Hoboken"],
    "NM": ["Albuquerque", "Santa Fe", "Las Cruces"],
    "NY": ["New York City", "Buffalo", "Rochester", "Syracuse", "Yonkers"],
    "NC": ["Charlotte", "Greensboro", "Asheville", "Winston-Salem", "Wilmington", "Fayetteville"],
    "ND": ["Fargo", "Bismarck"],
    "OH": ["Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Columbus"],
    "OK": ["Oklahoma City", "Tulsa", "Norman"],
    "OR": ["Portland", "Eugene", "Bend", "Beaverton"],
    "PA": ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Scranton"],
    "RI": ["Providence", "Warwick", "Cranston"],
    "SC": ["Charleston", "Columbia", "Greenville", "Myrtle Beach", "Rock Hill"],
    "SD": ["Sioux Falls", "Rapid City"],
    "TN": ["Nashville", "Memphis", "Knoxville", "Chattanooga"],
    "TX": ["Dallas", "Houston", "Austin", "San Antonio", "Fort Worth", "El Paso", "Plano"],
    "UT": ["Salt Lake City", "Provo", "Ogden"],
    "VT": ["Burlington", "Montpelier"],
    "VA": ["Virginia Beach", "Richmond", "Norfolk", "Arlington", "Alexandria", "Chesapeake", "Roanoke"],
    "WA": ["Seattle", "Tacoma", "Spokane", "Bellevue"],
    "WV": ["Charleston", "Morgantown", "Huntington", "Wheeling"],
    "WI": ["Milwaukee", "Madison", "Green Bay", "Kenosha"],
    "WY": ["Cheyenne", "Casper", "Laramie"],
    "DC": ["Washington, DC"]
  },
  "originAmbiguousCities": ["Alexandria", "Arlington", "Augusta", "Burlington", "Columbus", "Dover", "Greenville", "Jackson", "Kansas City", "Lincoln", "Madison", "Manchester", "Portland", "Richmond", "Rochester", "Springfield"],
  "originCityOptions": { "portland": ["Oregon", "Maine"] },
  "relocationResponses": {
    "price": "Fair enough!",
    "californiaPrice": "I hear that! We get a lot of people from California who realize they can get more home for the money here in Raleigh.",
    "weather": "Totally get that. That's one of the top reasons people move to Raleigh: we get all four seasons, and the weather is fairly mild overall.",
    "family": "Oh, awesome.",
    "job": "Congrats! That's super exciting.",
    "cityTexas": "Oh, Texas? That's awesome. We get a lot of folks from down there."
  },
  "originAcknowledgements": {
    "ohio": "Great. We've worked with multiple families relocating from Ohio.",
    "new york": "Great. We get a lot of people relocating from New York."
  },
  "safetyWarning": "Let's keep this focused on your real estate question. Are you looking to buy or sell in Raleigh?",
  "safetyEnd": "I'm going to end this conversation for now. Please reach out in the future if you're thinking about buying or selling in Raleigh.",
  "unknownQuestion": "That's one of the many questions we can go over on an exploration call with the team."
};
