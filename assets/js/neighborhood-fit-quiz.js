(() => {
  const LEAD_CAPTURE_ENDPOINT = "https://script.google.com/macros/s/AKfycbwnqkPb6Nkp9owlDv_orcAId7cNHbKuQrf5ENMW4BvbUuaLFNHP-yANDdSwQ6Vjl41v/exec";
  const ANALYTICS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzBMxFBoQZBWSCdVCRnW4kFnjyoGZA2F-3ym2rqW-fVMFa1Wx5xT5SNMrvZdP3Xky0/exec";
  const QUIZ_SUCCESS_REDIRECT_MS = 3000;
  const TRAIT_KEYS = [
    "resale",
    "newConstruction",
    "walkability",
    "family",
    "schools",
    "luxury",
    "value",
    "quiet",
    "space",
    "amenities",
    "outdoors",
    "socialLifestyle",
    "trafficSensitive",
    "commuteRaleigh",
    "commuteRTP",
    "commuteDurham",
    "lowMaintenance",
    "growth",
    "establishedCharm",
    "downtownEnergy",
    "urban"
  ];

  const OPTION_SETS = {
    homeStyle: [
      { label: "Historic resale with character", traits: { resale: 5, establishedCharm: 4, downtownEnergy: 1 } },
      { label: "Updated resale in an established area", traits: { resale: 4, lowMaintenance: 2, value: 2 } },
      { label: "Brand-new construction", traits: { newConstruction: 5, lowMaintenance: 2 } },
      { label: "A townhome or low-maintenance home", traits: { lowMaintenance: 4, amenities: 1 } },
      { label: "A larger or more upscale home", traits: { luxury: 4, space: 2, amenities: 1 } }
    ],
    vibe: [
      { label: "Walkable, social, and active", traits: { walkability: 4, socialLifestyle: 3, downtownEnergy: 2, urban: 1 } },
      { label: "Family-oriented and neighborhood-focused", traits: { family: 4, schools: 2, quiet: 1 } },
      { label: "Quiet, mature, and established", traits: { quiet: 4, establishedCharm: 3, resale: 2 } },
      { label: "Amenity-rich with pools and clubs", traits: { amenities: 4, family: 2, newConstruction: 1 } },
      { label: "Spacious and a little more relaxed", traits: { space: 4, quiet: 2, trafficSensitive: 1 } }
    ],
    commute: [
      { label: "Raleigh and downtown access", traits: { commuteRaleigh: 5, urban: 1 } },
      { label: "RTP and airport convenience", traits: { commuteRTP: 5, lowMaintenance: 1 } },
      { label: "Durham and Duke-side access", traits: { commuteDurham: 5, urban: 1 } },
      { label: "I want a flexible central location", traits: { commuteRaleigh: 2, commuteRTP: 2, commuteDurham: 1 } },
      { label: "I care more about the home than the commute", traits: { value: 2, space: 1, quiet: 1 } }
    ],
    schools: [
      { label: "Top-rated schools are a priority", traits: { schools: 5, family: 2 } },
      { label: "Strong family neighborhoods matter most", traits: { family: 4, schools: 3 } },
      { label: "Schools are nice, but not the main driver", traits: { value: 2, commuteRaleigh: 1 } },
      { label: "I care more about lifestyle than schools", traits: { socialLifestyle: 3, walkability: 2, amenities: 1 } },
      { label: "I want a good balance of all three", traits: { schools: 3, amenities: 2, quiet: 1 } }
    ],
    budget: [
      { label: "I want the most premium option", traits: { luxury: 4, establishedCharm: 2 } },
      { label: "I can stretch for the right home", traits: { luxury: 2, walkability: 2, downtownEnergy: 1 } },
      { label: "I want the best overall value", traits: { value: 5 } },
      { label: "I want a lower-maintenance payment", traits: { lowMaintenance: 3, value: 2 } },
      { label: "I want more space for the money", traits: { space: 4, value: 2 } }
    ],
    amenities: [
      { label: "Restaurants, coffee, and nightlife", traits: { socialLifestyle: 4, walkability: 3, amenities: 2, downtownEnergy: 2 } },
      { label: "Pools, clubhouses, and neighborhood events", traits: { amenities: 4, family: 2 } },
      { label: "Parks, trails, and greenways", traits: { outdoors: 4, quiet: 1 } },
      { label: "Everyday shopping and convenience", traits: { amenities: 3, commuteRTP: 1, lowMaintenance: 1 } },
      { label: "A quiet neighborhood with fewer distractions", traits: { quiet: 4, trafficSensitive: 2 } }
    ],
    newResale: [
      { label: "Historic resale homes", traits: { resale: 5, establishedCharm: 4 } },
      { label: "Established resale with updates", traits: { resale: 4, lowMaintenance: 2 } },
      { label: "A true mix of resale and new homes", traits: { resale: 2, newConstruction: 2, growth: 1 } },
      { label: "Brand-new construction", traits: { newConstruction: 5, lowMaintenance: 2 } },
      { label: "I prefer low-maintenance living either way", traits: { lowMaintenance: 4 } }
    ],
    outdoors: [
      { label: "Greenways and trails", traits: { outdoors: 5, quiet: 1 } },
      { label: "Lakes and parks", traits: { outdoors: 4, space: 1 } },
      { label: "Golf or country-club amenities", traits: { luxury: 2, amenities: 3, outdoors: 1 } },
      { label: "Backyard space and room to spread out", traits: { space: 4, quiet: 2 } },
      { label: "I mostly care about location and convenience", traits: { commuteRaleigh: 2, commuteRTP: 2, urban: 1 } }
    ],
    traffic: [
      { label: "I am highly traffic-sensitive", traits: { trafficSensitive: 5, quiet: 1 } },
      { label: "I want a short commute even if the home is smaller", traits: { commuteRTP: 2, commuteRaleigh: 2, commuteDurham: 2 } },
      { label: "I can handle some traffic for the right neighborhood", traits: { value: 2, growth: 1 } },
      { label: "I prefer a quieter area even if it is farther out", traits: { quiet: 4, space: 2 } },
      { label: "I want easy access to major roads and errands", traits: { amenities: 2, commuteRTP: 1, lowMaintenance: 1 } }
    ],
    growth: [
      { label: "A well-established neighborhood feels right", traits: { resale: 4, establishedCharm: 4 } },
      { label: "I like areas that are growing but grounded", traits: { growth: 4, value: 2 } },
      { label: "I want the newest pockets of development", traits: { newConstruction: 4, growth: 2 } },
      { label: "I want a neighborhood that already feels complete", traits: { quiet: 3, amenities: 2 } },
      { label: "I want the best long-term upside", traits: { growth: 5, value: 2 } }
    ]
  };

  const QUIZZES = {
    raleigh: {
      slug: "raleigh",
      city: "Raleigh",
      title: "Raleigh Neighborhood Fit",
      intro: "Lean resale and close-in access drive this Raleigh quiz. We will narrow the city to three neighborhoods that fit your pace, your budget, and the way you actually want to live.",
      heroImage: "/assets/images/communities/north-raleigh.jpg",
      heroAlt: "Raleigh neighborhoods and city access",
      quizSubject: "Your Raleigh Neighborhood Fit Results!",
      videoUrl: "https://www.youtube-nocookie.com/embed/UVWafIUp0BQ?rel=0&modestbranding=1",
      videoTitle: "Raleigh neighborhood video tour",
      questions: [
        makeQuestion("Which Raleigh home style feels most like you?", "homeStyle"),
        makeQuestion("What kind of Raleigh setting do you want most?", "vibe"),
        makeQuestion("Where do you want the easiest daily access?", "commute"),
        makeQuestion("How much weight do you put on schools and long-term resale?", "schools"),
        makeQuestion("What tradeoff would you accept most easily?", "budget"),
        makeQuestion("Which nearby amenities would you use most often?", "amenities"),
        makeQuestion("How do you feel about newer construction?", "newResale"),
        makeQuestion("What would make weekends feel right in Raleigh?", "outdoors")
      ],
      neighborhoods: [
        {
          suburb: "Five Points",
          image: "/assets/images/communities/itb.jpg",
          imageAlt: "Five Points area in Raleigh",
          typeLabel: "Resale-heavy",
          group: "ITB",
          summary: "Historic, central, and easy to love if you want a classic Raleigh resale neighborhood with personality.",
          why: "Best for buyers who want character homes, mature streets, and quick access to downtown Raleigh.",
          homes: "Bungalows, renovated cottages, and established single-family homes.",
          access: "Strong Raleigh access with fast trips to downtown, North Hills, and the inner beltline.",
          amenities: "Coffee, restaurants, parks, and neighborhood nightlife are all part of the draw.",
          learnMoreUrl: "/explore-the-area/raleigh/",
          traits: { resale: 5, walkability: 5, downtownEnergy: 4, urban: 4, socialLifestyle: 4, establishedCharm: 5, commuteRaleigh: 5, amenities: 3, family: 2, schools: 2, quiet: 1, space: 1, luxury: 2, value: 2, lowMaintenance: 1, growth: 1 }
        },
        {
          suburb: "Historic Oakwood",
          image: "/assets/images/communities/itb.jpg",
          imageAlt: "Historic Oakwood area in Raleigh",
          typeLabel: "Resale-heavy",
          group: "ITB",
          summary: "One of Raleigh’s signature historic neighborhoods with a preserved streetscape and a strong old-Raleigh feel.",
          why: "Best if you want a true historic resale neighborhood with character, charm, and central convenience.",
          homes: "Historic homes, renovated classics, and limited-inventory resale properties.",
          access: "Close to downtown Raleigh, museums, and core city amenities.",
          amenities: "Walkable access to eateries, events, and the kind of neighborhood energy that stays active.",
          learnMoreUrl: "/explore-the-area/raleigh/",
          traits: { resale: 5, walkability: 4, downtownEnergy: 5, urban: 4, socialLifestyle: 3, establishedCharm: 5, commuteRaleigh: 5, amenities: 3, family: 2, schools: 2, quiet: 1, space: 1, luxury: 2, value: 1, lowMaintenance: 1, growth: 1 }
        },
        {
          suburb: "North Hills",
          image: "/assets/images/communities/north-raleigh.jpg",
          imageAlt: "North Hills area in Raleigh",
          typeLabel: "Lifestyle mix",
          group: "Midtown",
          summary: "Raleigh’s midtown energy with shopping, restaurants, and a mix of established homes and newer product.",
          why: "Best for buyers who want polished convenience, a social feel, and a strong everyday amenities package.",
          homes: "Updated resale homes, upscale condos, townhomes, and a smaller number of newer builds.",
          access: "Excellent access to central Raleigh and major commute routes.",
          amenities: "Restaurants, retail, entertainment, fitness, and everyday errands are right nearby.",
          learnMoreUrl: "/explore-the-area/raleigh/",
          traits: { resale: 3, walkability: 4, downtownEnergy: 4, urban: 3, socialLifestyle: 4, establishedCharm: 2, commuteRaleigh: 4, amenities: 5, family: 3, schools: 3, quiet: 2, space: 2, luxury: 4, value: 2, lowMaintenance: 3, growth: 2 }
        },
        {
          suburb: "North Raleigh",
          image: "/assets/images/communities/north-raleigh.jpg",
          imageAlt: "North Raleigh area",
          typeLabel: "Resale-heavy",
          group: "North Raleigh",
          summary: "A reliable choice if you want established neighborhoods, more space, and a family-friendly feel.",
          why: "Best for buyers who care about schools, quieter streets, and classic Raleigh suburb comfort.",
          homes: "Traditional single-family resale homes, larger lots, and updated established properties.",
          access: "Solid access to downtown Raleigh, North Hills, and the RTP corridor.",
          amenities: "Greenways, parks, schools, and convenient shopping are all part of the draw.",
          learnMoreUrl: "/explore-the-area/raleigh/",
          traits: { resale: 5, family: 4, schools: 4, quiet: 4, space: 4, commuteRaleigh: 4, commuteRTP: 3, amenities: 3, establishedCharm: 4, value: 3, lowMaintenance: 2, growth: 2, luxury: 2, outdoors: 4, trafficSensitive: 3 }
        },
        {
          suburb: "Inside the Beltline",
          image: "/assets/images/communities/itb.jpg",
          imageAlt: "Inside the Beltline Raleigh area",
          typeLabel: "Resale-heavy",
          group: "ITB",
          summary: "The classic close-in Raleigh choice for buyers who want walkability, character, and a real city feel.",
          why: "Best for people who care most about location, historic neighborhoods, and a short hop to downtown.",
          homes: "Historic homes, renovated cottages, and premium resale properties.",
          access: "The closest day-to-day access in the city for many downtown-oriented buyers.",
          amenities: "Restaurants, parks, coffee, and neighborhood institutions keep the area feeling active.",
          learnMoreUrl: "/explore-the-area/raleigh/",
          traits: { resale: 5, walkability: 5, downtownEnergy: 5, urban: 5, socialLifestyle: 4, establishedCharm: 4, commuteRaleigh: 5, amenities: 4, family: 2, schools: 2, quiet: 1, space: 1, luxury: 3, value: 1, lowMaintenance: 1, growth: 2 }
        }
      ]
    },
    cary: {
      slug: "cary",
      city: "Cary",
      title: "Cary Neighborhood Fit",
      intro: "Cary leans established and resale-forward in this quiz. Tell us what matters most and we will focus your results on the Cary neighborhoods that buyers consistently compare first.",
      heroImage: "/assets/images/communities/cary.jpg",
      heroAlt: "Cary neighborhoods and streets",
      quizSubject: "Your Cary Neighborhood Fit Results!",
      videoUrl: "https://www.youtube-nocookie.com/embed/EtcZP6Xf1k4?rel=0&modestbranding=1",
      videoTitle: "Cary neighborhood video tour",
      questions: [
        makeQuestion("Which Cary home style feels most appealing?", "homeStyle"),
        makeQuestion("What kind of Cary lifestyle do you want?", "vibe"),
        makeQuestion("Where do you need the easiest access?", "commute"),
        makeQuestion("How important are top schools and family amenities?", "schools"),
        makeQuestion("What budget tradeoff are you comfortable making?", "budget"),
        makeQuestion("Which amenities would you use the most in Cary?", "amenities"),
        makeQuestion("How do you feel about newer neighborhoods in Cary?", "newResale"),
        makeQuestion("What kind of weekend setting feels best?", "outdoors")
      ],
      neighborhoods: [
        {
          suburb: "Preston",
          image: "/assets/images/communities/cary.jpg",
          imageAlt: "Preston area in Cary",
          typeLabel: "Resale-heavy",
          group: "West Cary",
          summary: "One of Cary’s flagship established neighborhoods with upscale homes, golf, and a long-running reputation.",
          why: "Best if you want premium resale, strong school context, and a polished Cary address.",
          homes: "Upscale resale homes, golf-course properties, and larger single-family houses.",
          access: "Strong access to RTP, west Cary, and central Cary corridors.",
          amenities: "Golf, club amenities, nearby retail, and a more refined suburban feel.",
          learnMoreUrl: "/explore-the-area/cary/",
          traits: { resale: 5, luxury: 5, family: 4, schools: 5, quiet: 4, space: 3, commuteRTP: 5, commuteRaleigh: 3, amenities: 4, establishedCharm: 4, lowMaintenance: 2, growth: 2, outdoors: 3, trafficSensitive: 2, value: 1 }
        },
        {
          suburb: "Lochmere",
          image: "/assets/images/communities/cary.jpg",
          imageAlt: "Lochmere area in Cary",
          typeLabel: "Resale-heavy",
          group: "South Cary",
          summary: "A long-loved Cary neighborhood with greenways, lakes, and a strong established-suburb feel.",
          why: "Best for buyers who want family appeal, outdoor space, and a resale neighborhood with staying power.",
          homes: "Traditional single-family homes and updated resale properties with mature landscaping.",
          access: "Convenient to south Cary, Downtown Cary, and major routes toward Raleigh.",
          amenities: "Greenways, lakes, neighborhood recreation, and nearby shopping make daily life easy.",
          learnMoreUrl: "/explore-the-area/cary/",
          traits: { resale: 5, family: 5, schools: 4, outdoors: 5, quiet: 4, space: 3, commuteRaleigh: 3, commuteRTP: 4, amenities: 4, establishedCharm: 4, value: 3, lowMaintenance: 2, trafficSensitive: 3, growth: 2 }
        },
        {
          suburb: "Downtown Cary",
          image: "/assets/images/communities/cary.jpg",
          imageAlt: "Downtown Cary area",
          typeLabel: "Resale and mixed-use",
          group: "Core Cary",
          summary: "The walkable Cary option for people who want restaurants, events, and a more urban-in-Cary feel.",
          why: "Best if you want a smaller footprint, walkability, and the convenience of being right in the middle of Cary’s momentum.",
          homes: "Updated resale homes, condos, townhomes, and a small number of new mixed-use options.",
          access: "Easy access to major Cary roads and straightforward trips to RTP or Raleigh.",
          amenities: "Restaurants, the park, events, and daily conveniences are close by.",
          learnMoreUrl: "/explore-the-area/cary/",
          traits: { resale: 4, walkability: 5, downtownEnergy: 5, urban: 4, socialLifestyle: 4, lowMaintenance: 4, commuteRaleigh: 3, commuteRTP: 4, amenities: 5, establishedCharm: 3, value: 2, family: 2, schools: 3, quiet: 1, growth: 3 }
        },
        {
          suburb: "Carpenter Village",
          image: "/assets/images/communities/cary.jpg",
          imageAlt: "Carpenter Village in Cary",
          typeLabel: "Resale-heavy",
          group: "West Cary",
          summary: "A new-urbanist Cary community with front porches, ponds, and a neighborhood identity that still feels established.",
          why: "Best for buyers who want a prettier, walkable community without giving up Cary’s resale stability.",
          homes: "Townhomes, single-family resale homes, and a mix of updated floor plans.",
          access: "Convenient to west Cary shopping, greenways, and RTP-bound commutes.",
          amenities: "Ponds, trails, sidewalks, and neighborhood gathering spaces shape the daily feel.",
          learnMoreUrl: "/explore-the-area/cary/",
          traits: { resale: 4, walkability: 4, family: 4, schools: 4, amenities: 4, outdoors: 4, socialLifestyle: 3, lowMaintenance: 3, commuteRTP: 4, commuteRaleigh: 2, establishedCharm: 4, quiet: 3, value: 3, growth: 2 }
        },
        {
          suburb: "West Cary",
          image: "/assets/images/communities/cary.jpg",
          imageAlt: "West Cary area",
          typeLabel: "Mix of resale and newer homes",
          group: "West Cary",
          summary: "A broad west Cary catch-all for buyers who want newer inventory, strong schools, and fast RTP access.",
          why: "Best for people who are willing to trade some resale charm for newer finishes, amenities, and convenience.",
          homes: "Newer single-family homes, townhomes, and resale pockets that stay competitive.",
          access: "Excellent for RTP and easy enough for Raleigh when you need it.",
          amenities: "Shopping, schools, and planned communities are the core appeal here.",
          learnMoreUrl: "/explore-the-area/cary/",
          traits: { resale: 2, newConstruction: 4, schools: 5, family: 4, amenities: 5, lowMaintenance: 4, commuteRTP: 5, commuteRaleigh: 3, value: 2, growth: 4, quiet: 3, space: 3, trafficSensitive: 2, outdoors: 3 }
        }
      ]
    },
    "wake-forest": {
      slug: "wake-forest",
      city: "Wake Forest",
      title: "Wake Forest Neighborhood Fit",
      intro: "Wake Forest is a true mix of established resale neighborhoods and newer communities. This quiz helps separate the family-first, trail-friendly, and new-construction options that fit your answer pattern best.",
      heroImage: "/assets/images/communities/wake-forest.jpg",
      heroAlt: "Wake Forest neighborhoods and downtown streets",
      quizSubject: "Your Wake Forest Neighborhood Fit Results!",
      videoUrl: "https://www.youtube-nocookie.com/embed/WC5ofUmInYI?rel=0&modestbranding=1",
      videoTitle: "Wake Forest neighborhood video tour",
      questions: [
        makeQuestion("Which Wake Forest home style feels right to you?", "homeStyle"),
        makeQuestion("What kind of Wake Forest vibe do you want?", "vibe"),
        makeQuestion("How important are schools and neighborhood stability?", "schools"),
        makeQuestion("Would you rather be in an established area or a newer one?", "newResale"),
        makeQuestion("How far are you okay being from Raleigh or RTP?", "commute"),
        makeQuestion("What amenities would you actually use in Wake Forest?", "amenities"),
        makeQuestion("Which outdoor setting feels most like home?", "outdoors"),
        makeQuestion("How much traffic are you willing to trade for the right neighborhood?", "traffic")
      ],
      neighborhoods: [
        {
          suburb: "Heritage",
          image: "/assets/images/communities/wake-forest.jpg",
          imageAlt: "Heritage area in Wake Forest",
          typeLabel: "Resale-heavy",
          group: "Heritage",
          summary: "Wake Forest’s signature master-planned neighborhood with a strong resale base and a big family draw.",
          why: "Best for families who want schools, amenities, and a long-established Wake Forest address.",
          homes: "Traditional single-family homes, updated resale properties, and some golf/community options.",
          access: "Solid access to central Wake Forest and the main commuter routes south.",
          amenities: "Golf, trails, lake life, and neighborhood recreation are central to the appeal.",
          learnMoreUrl: "/explore-the-area/wake-forest/",
          traits: { resale: 5, family: 5, schools: 5, amenities: 4, outdoors: 4, quiet: 4, establishedCharm: 4, commuteRaleigh: 3, commuteRTP: 2, value: 3, luxury: 3, lowMaintenance: 2, growth: 2, trafficSensitive: 3, newConstruction: 1 }
        },
        {
          suburb: "Holding Village",
          image: "/assets/images/communities/wake-forest.jpg",
          imageAlt: "Holding Village in Wake Forest",
          typeLabel: "New-construction mix",
          group: "North Wake Forest",
          summary: "A newer traditional-style community with lake, trails, and a more intentional neighborhood feel.",
          why: "Best for buyers who want newer homes but still want a neighborhood that feels connected and walkable.",
          homes: "New construction homes, townhomes, and newer community options.",
          access: "Convenient to Heritage-side amenities and the Wake Forest corridor.",
          amenities: "Trails, lake access, and planned community features are the big draw.",
          learnMoreUrl: "/explore-the-area/wake-forest/",
          traits: { newConstruction: 5, lowMaintenance: 4, outdoors: 4, amenities: 4, family: 4, schools: 4, growth: 4, walkability: 3, quiet: 3, commuteRaleigh: 2, commuteRTP: 2, value: 3, trafficSensitive: 2, establishedCharm: 1 }
        },
        {
          suburb: "Traditions at Wake Forest",
          image: "/assets/images/communities/wake-forest.jpg",
          imageAlt: "Traditions at Wake Forest",
          typeLabel: "New-construction friendly",
          group: "North Wake Forest",
          summary: "A newer, amenity-rich Wake Forest community that works well for buyers who want a more modern neighborhood setup.",
          why: "Best if you want newer construction, a resort-style feel, and strong neighborhood amenities.",
          homes: "New construction homes, active-adult options, and low-maintenance layouts.",
          access: "Good access to Wake Forest services and quick routes south toward Raleigh.",
          amenities: "Pool, trails, preservation areas, and a built-in community rhythm.",
          learnMoreUrl: "/explore-the-area/wake-forest/",
          traits: { newConstruction: 5, amenities: 5, lowMaintenance: 4, family: 4, schools: 4, quiet: 3, outdoors: 4, growth: 4, value: 2, commuteRaleigh: 2, commuteRTP: 2, trafficSensitive: 2, luxury: 2 }
        },
        {
          suburb: "Wake Forest Historic District",
          image: "/assets/images/communities/wake-forest.jpg",
          imageAlt: "Wake Forest historic district",
          typeLabel: "Resale-heavy",
          group: "Downtown Wake Forest",
          summary: "The classic downtown option for buyers who want older homes, local energy, and a walkable town center.",
          why: "Best if you like a more established neighborhood feel and want to be close to the town core.",
          homes: "Historic homes, updated resale properties, and older in-town homes with character.",
          access: "Close to downtown Wake Forest and easy to understand day-to-day.",
          amenities: "Local shops, cafes, and a walkable small-town core are the pull here.",
          learnMoreUrl: "/explore-the-area/wake-forest/",
          traits: { resale: 5, walkability: 4, downtownEnergy: 4, urban: 2, establishedCharm: 5, socialLifestyle: 3, commuteRaleigh: 2, commuteRTP: 1, amenities: 4, quiet: 2, value: 2, family: 3, schools: 3, growth: 2 }
        },
        {
          suburb: "Stonegate",
          image: "/assets/images/communities/wake-forest.jpg",
          imageAlt: "Stonegate area in Wake Forest",
          typeLabel: "Resale-heavy",
          group: "North Wake Forest",
          summary: "A family-friendly Wake Forest pick when you want a mature neighborhood, schools, and a more classic suburban feel.",
          why: "Best for buyers who want resale stability without jumping all the way to the newest communities.",
          homes: "Established single-family homes, updated resale properties, and neighborhood streets with character.",
          access: "Good Wake Forest access and reasonable routes toward Raleigh.",
          amenities: "Neighborhood recreation, schools, and a quieter suburban feel anchor the area.",
          learnMoreUrl: "/explore-the-area/wake-forest/",
          traits: { resale: 5, family: 4, schools: 4, quiet: 4, space: 3, establishedCharm: 4, commuteRaleigh: 2, commuteRTP: 1, amenities: 3, lowMaintenance: 2, value: 3, outdoors: 3, trafficSensitive: 3 }
        }
      ]
    },
    morrisville: {
      slug: "morrisville",
      city: "Morrisville",
      title: "Morrisville Neighborhood Fit",
      intro: "Morrisville is all about convenience to RTP, RDU, and the western Wake job corridor. The neighborhoods below lean resale but still capture the mix of townhomes, established communities, and newer options that buyers compare here first.",
      heroImage: "/assets/images/communities/morrisville.jpg",
      heroAlt: "Morrisville neighborhoods and streets",
      quizSubject: "Your Morrisville Neighborhood Fit Results!",
      videoUrl: "https://www.youtube-nocookie.com/embed/qqnyJVTXzB8?rel=0&modestbranding=1",
      videoTitle: "Morrisville neighborhood video tour",
      questions: [
        makeQuestion("Which Morrisville home style fits your life?", "homeStyle"),
        makeQuestion("What kind of daily routine do you want in Morrisville?", "vibe"),
        makeQuestion("How important is being close to RTP or RDU?", "commute"),
        makeQuestion("What matters more: established resale or newer convenience?", "newResale"),
        makeQuestion("How much maintenance do you want to avoid?", "budget"),
        makeQuestion("What amenities would you use most often?", "amenities"),
        makeQuestion("How much family or school focus do you want?", "schools"),
        makeQuestion("What kind of growth story do you want?", "growth")
      ],
      neighborhoods: [
        {
          suburb: "Kitts Creek",
          image: "/assets/images/communities/morrisville.jpg",
          imageAlt: "Kitts Creek in Morrisville",
          typeLabel: "Resale and newer mix",
          group: "Morrisville Core",
          summary: "One of Morrisville’s most recognizable neighborhoods for commuters who want a convenient, amenity-rich base.",
          why: "Best for RTP buyers who want a built-out neighborhood with a strong community feel.",
          homes: "Single-family homes, townhomes, and a mix of established and newer inventory.",
          access: "Excellent for RTP, western Wake, and airport convenience.",
          amenities: "Neighborhood amenities, parks, and a convenient central location are the story here.",
          learnMoreUrl: "/explore-the-area/morrisville/",
          traits: { resale: 3, newConstruction: 3, commuteRTP: 5, commuteDurham: 3, commuteRaleigh: 3, amenities: 4, lowMaintenance: 3, family: 4, schools: 3, growth: 3, value: 3, quiet: 2, space: 2, trafficSensitive: 2 }
        },
        {
          suburb: "Prestonwood",
          image: "/assets/images/communities/morrisville.jpg",
          imageAlt: "Prestonwood area in Morrisville",
          typeLabel: "Resale-heavy",
          group: "Morrisville Core",
          summary: "An established, higher-end Morrisville choice with country-club energy and strong RTP convenience.",
          why: "Best if you want a premium resale neighborhood with amenities and a polished feel.",
          homes: "Established single-family homes, larger lots, and golf-oriented properties.",
          access: "Very strong access to RTP and quick routes toward Cary and Raleigh.",
          amenities: "Golf, club amenities, and neighborhood recreation shape the appeal.",
          learnMoreUrl: "/explore-the-area/morrisville/",
          traits: { resale: 5, luxury: 4, commuteRTP: 5, commuteRaleigh: 3, family: 4, schools: 4, amenities: 4, quiet: 3, establishedCharm: 4, lowMaintenance: 2, value: 2, trafficSensitive: 2, growth: 2 }
        },
        {
          suburb: "Carpenter Park",
          image: "/assets/images/communities/morrisville.jpg",
          imageAlt: "Carpenter Park area in Morrisville",
          typeLabel: "Resale-heavy",
          group: "Morrisville Core",
          summary: "A family-friendly Morrisville neighborhood when schools, parks, and a comfortable suburban setting matter most.",
          why: "Best for buyers who want a stable resale neighborhood with neighborhood recreation and a practical location.",
          homes: "Traditional single-family homes and townhomes with a suburban layout.",
          access: "Good access to Morrisville-Carpenter Road and the broader RTP corridor.",
          amenities: "Parks, playgrounds, and nearby daily conveniences make it easy to live in.",
          learnMoreUrl: "/explore-the-area/morrisville/",
          traits: { resale: 4, family: 5, schools: 4, quiet: 3, space: 3, amenities: 4, commuteRTP: 4, commuteRaleigh: 2, outdoors: 3, lowMaintenance: 2, value: 3, establishedCharm: 3, growth: 2, trafficSensitive: 2 }
        },
        {
          suburb: "Village at Town Hall Commons",
          image: "/assets/images/communities/morrisville.jpg",
          imageAlt: "Town Hall Commons area in Morrisville",
          typeLabel: "New-construction friendly",
          group: "Morrisville Core",
          summary: "A more modern Morrisville option for buyers who want newer product and a central village-style setting.",
          why: "Best if you want low-maintenance living and newer homes without giving up Morrisville convenience.",
          homes: "Newer townhomes and modern low-maintenance layouts.",
          access: "Close to town services, parks, and the central Morrisville corridor.",
          amenities: "Walkable or easy-access errands and a more modern town-center feel.",
          learnMoreUrl: "/explore-the-area/morrisville/",
          traits: { newConstruction: 5, lowMaintenance: 5, amenities: 4, commuteRTP: 4, commuteRaleigh: 2, growth: 4, value: 3, family: 3, schools: 3, quiet: 2, urban: 2, walkability: 3, trafficSensitive: 2 }
        },
        {
          suburb: "Park West",
          image: "/assets/images/communities/morrisville.jpg",
          imageAlt: "Park West area in Morrisville",
          typeLabel: "Mix of resale and newer homes",
          group: "Morrisville Core",
          summary: "A practical, central Morrisville choice when convenience, shopping, and flexible housing options matter most.",
          why: "Best for buyers who want a mix of resale and newer inventory with easy daily access.",
          homes: "Townhomes, single-family homes, and newer pockets that keep the market active.",
          access: "Quick access to shopping, RTP, and nearby major roads.",
          amenities: "Retail, dining, and everyday convenience are the main advantages.",
          learnMoreUrl: "/explore-the-area/morrisville/",
          traits: { resale: 3, newConstruction: 3, commuteRTP: 4, commuteRaleigh: 3, amenities: 5, lowMaintenance: 4, family: 3, schools: 3, value: 3, growth: 3, quiet: 2, trafficSensitive: 2 }
        }
      ]
    },
    durham: {
      slug: "durham",
      city: "Durham",
      title: "Durham Neighborhood Fit",
      intro: "Durham gives you the most obvious mix of historic resale, walkable city living, and newer communities. This quiz helps separate those lanes so your top three feel genuinely different from one another.",
      heroImage: "/assets/images/communities/durham.jpg",
      heroAlt: "Durham neighborhoods and downtown character",
      quizSubject: "Your Durham Neighborhood Fit Results!",
      videoUrl: "https://www.youtube-nocookie.com/embed/HRygIJl3zzQ?rel=0&modestbranding=1",
      videoTitle: "Durham neighborhood video tour",
      questions: [
        makeQuestion("Which Durham home style speaks to you most?", "homeStyle"),
        makeQuestion("What kind of Durham vibe do you want?", "vibe"),
        makeQuestion("How close do you want to be to downtown Durham or Duke?", "commute"),
        makeQuestion("Do you want historic resale, newer construction, or a mix?", "newResale"),
        makeQuestion("How important are trails, parks, and outdoor space?", "outdoors"),
        makeQuestion("Would you rather have walkability or more house for the money?", "budget"),
        makeQuestion("How much do you care about quick RTP access?", "commute"),
        makeQuestion("What pace do you want from Durham day to day?", "traffic")
      ],
      neighborhoods: [
        {
          suburb: "Trinity Park",
          image: "/assets/images/communities/durham.jpg",
          imageAlt: "Trinity Park in Durham",
          typeLabel: "Resale-heavy",
          group: "Urban Durham",
          summary: "A classic walkable Durham neighborhood with strong historic character and a real sense of place.",
          why: "Best for buyers who want a central, established neighborhood near Duke and downtown Durham.",
          homes: "Historic homes, renovated resale properties, and classic Durham architecture.",
          access: "Excellent for downtown Durham, Duke, and quick urban access.",
          amenities: "Walkability, neighborhood events, and city life are the main attraction.",
          learnMoreUrl: "/explore-the-area/durham/",
          traits: { resale: 5, walkability: 5, downtownEnergy: 5, urban: 5, socialLifestyle: 4, establishedCharm: 5, commuteDurham: 5, amenities: 4, quiet: 1, space: 1, family: 2, schools: 2, value: 2, growth: 2, lowMaintenance: 1 }
        },
        {
          suburb: "Hope Valley",
          image: "/assets/images/communities/durham.jpg",
          imageAlt: "Hope Valley in Durham",
          typeLabel: "Resale-heavy",
          group: "South Durham",
          summary: "Durham’s classic country-club, larger-lot resale neighborhood with a calmer and more established feel.",
          why: "Best for buyers who want space, quiet, and a premium established neighborhood profile.",
          homes: "Traditional resale homes, larger lots, and country-club-adjacent properties.",
          access: "Good access to Chapel Hill, RTP, Raleigh, and south Durham corridors.",
          amenities: "Golf, larger lots, and a residential feel dominate the experience.",
          learnMoreUrl: "/explore-the-area/durham/",
          traits: { resale: 5, luxury: 4, space: 5, quiet: 5, family: 4, schools: 4, commuteDurham: 4, commuteRTP: 3, commuteRaleigh: 2, establishedCharm: 5, trafficSensitive: 4, amenities: 3, outdoors: 3, value: 2 }
        },
        {
          suburb: "Woodcroft",
          image: "/assets/images/communities/durham.jpg",
          imageAlt: "Woodcroft in Durham",
          typeLabel: "Resale-heavy",
          group: "South Durham",
          summary: "A wooded, trail-connected Durham neighborhood that works especially well for RTP commuters who still want a real community.",
          why: "Best for buyers who want mature trees, trails, and a practical south Durham location.",
          homes: "Established single-family homes and updated resale options.",
          access: "Excellent for RTP, Southpoint, and south Durham travel.",
          amenities: "Trails, parks, shopping, and easy access to major commuter routes.",
          learnMoreUrl: "/explore-the-area/durham/",
          traits: { resale: 5, family: 4, outdoors: 5, commuteRTP: 5, commuteDurham: 4, quiet: 4, space: 3, schools: 4, value: 4, establishedCharm: 4, trafficSensitive: 3, amenities: 4, lowMaintenance: 2, growth: 2 }
        },
        {
          suburb: "Downtown Durham",
          image: "/assets/images/communities/durham.jpg",
          imageAlt: "Downtown Durham",
          typeLabel: "Urban mix",
          group: "Urban Durham",
          summary: "The urban Durham answer for buyers who want energy, restaurants, condos, and a very walkable lifestyle.",
          why: "Best if your ideal day starts with walkability and ends with a downtown dinner or show.",
          homes: "Condos, lofts, renovated homes, and a mix of newer infill.",
          access: "The strongest downtown walkability and city access in Durham.",
          amenities: "Restaurants, entertainment, and cultural venues are the headline here.",
          learnMoreUrl: "/explore-the-area/durham/",
          traits: { walkability: 5, downtownEnergy: 5, urban: 5, socialLifestyle: 5, lowMaintenance: 4, resale: 3, newConstruction: 2, commuteDurham: 5, amenities: 5, value: 2, quiet: 0, space: 0, family: 1, growth: 3 }
        },
        {
          suburb: "Carolina Arbors",
          image: "/assets/images/communities/durham.jpg",
          imageAlt: "Carolina Arbors in Durham",
          typeLabel: "New-construction friendly",
          group: "North Durham",
          summary: "A newer Durham community for buyers who want low-maintenance living, neighborhood amenities, and a more modern home base.",
          why: "Best for people who want brand-new or newer construction without leaving Durham behind.",
          homes: "New construction homes, low-maintenance layouts, and a more modern residential feel.",
          access: "Good access to north Durham, RTP, and airport-side travel.",
          amenities: "Amenities, community programming, and low-maintenance living are the big story.",
          learnMoreUrl: "/explore-the-area/durham/",
          traits: { newConstruction: 5, lowMaintenance: 5, amenities: 5, family: 3, schools: 3, growth: 4, commuteRTP: 4, commuteDurham: 3, value: 3, quiet: 3, space: 3, trafficSensitive: 2 }
        }
      ]
    },
    apex: {
      slug: "apex",
      city: "Apex",
      title: "Apex Neighborhood Fit",
      intro: "Apex is one of the best places to mix resale character with newer communities, so this quiz intentionally separates downtown charm from amenity-rich newer subdivisions.",
      heroImage: "/assets/images/communities/apex.jpg",
      heroAlt: "Apex neighborhoods and downtown streets",
      quizSubject: "Your Apex Neighborhood Fit Results!",
      videoUrl: "https://www.youtube-nocookie.com/embed/ZDmRAdvyKdw?rel=0&modestbranding=1",
      videoTitle: "Apex neighborhood video tour",
      questions: [
        makeQuestion("What kind of Apex home do you want most?", "homeStyle"),
        makeQuestion("Do you want downtown walkability or a newer amenity-rich community?", "vibe"),
        makeQuestion("How important are schools and family-friendly streets?", "schools"),
        makeQuestion("How do you feel about new construction?", "newResale"),
        makeQuestion("What commute matters most to you?", "commute"),
        makeQuestion("Would you rather have a bigger lot or lower maintenance?", "budget"),
        makeQuestion("How traffic-sensitive are you?", "traffic"),
        makeQuestion("What weekend setting sounds best in Apex?", "outdoors")
      ],
      neighborhoods: [
        {
          suburb: "Downtown Apex",
          image: "/assets/images/communities/apex.jpg",
          imageAlt: "Downtown Apex",
          typeLabel: "Resale-heavy",
          group: "Downtown Apex",
          summary: "The classic Apex answer for buyers who want small-town charm, walkability, and older homes with character.",
          why: "Best for buyers who want a historic downtown feel and a resale market that stays highly desirable.",
          homes: "Historic homes, renovated resale properties, and in-town character houses.",
          access: "Walkable to Salem Street and convenient to the Apex main corridors.",
          amenities: "Restaurants, local shops, and civic events make the area feel anchored and active.",
          learnMoreUrl: "/explore-the-area/apex/",
          traits: { resale: 5, walkability: 5, downtownEnergy: 4, urban: 3, establishedCharm: 5, socialLifestyle: 4, commuteRaleigh: 3, commuteRTP: 3, amenities: 4, family: 3, schools: 3, quiet: 2, value: 2, growth: 3 }
        },
        {
          suburb: "Bella Casa",
          image: "/assets/images/communities/apex.jpg",
          imageAlt: "Bella Casa in Apex",
          typeLabel: "New-construction mix",
          group: "South Apex",
          summary: "A popular Apex master-planned community with modern homes, neighborhood amenities, and a family-first setup.",
          why: "Best if you want newer construction, strong schools, and a community that feels fully built out.",
          homes: "Newer single-family homes, townhomes, and modern layouts.",
          access: "Convenient to downtown Apex, shopping, and major Wake County commute routes.",
          amenities: "Pools, trails, and a planned neighborhood feel are part of the appeal.",
          learnMoreUrl: "/explore-the-area/apex/",
          traits: { newConstruction: 5, family: 4, schools: 5, amenities: 5, lowMaintenance: 3, growth: 4, commuteRaleigh: 3, commuteRTP: 3, quiet: 3, value: 3, outdoors: 3 }
        },
        {
          suburb: "Scotts Mill",
          image: "/assets/images/communities/apex.jpg",
          imageAlt: "Scotts Mill in Apex",
          typeLabel: "Resale-heavy",
          group: "South Apex",
          summary: "A mature Apex neighborhood with a strong family reputation, amenities, and a lot of resale staying power.",
          why: "Best for buyers who want a classic suburban Apex feel with a more established inventory profile.",
          homes: "Established single-family homes, resale properties, and community-oriented streets.",
          access: "Good access to downtown Apex and the broader western Wake network.",
          amenities: "Neighborhood amenities, parks, and family-oriented common spaces are a big part of the appeal.",
          learnMoreUrl: "/explore-the-area/apex/",
          traits: { resale: 5, family: 4, schools: 4, quiet: 4, outdoors: 4, amenities: 4, establishedCharm: 4, value: 3, commuteRaleigh: 3, commuteRTP: 3, trafficSensitive: 2, growth: 2 }
        },
        {
          suburb: "Haddon Hall",
          image: "/assets/images/communities/apex.jpg",
          imageAlt: "Haddon Hall in Apex",
          typeLabel: "Resale-heavy",
          group: "South Apex",
          summary: "A polished Apex neighborhood with mature landscaping, community amenities, and long-term family appeal.",
          why: "Best for buyers who want a comfortable established neighborhood that still feels a little upscale.",
          homes: "Traditional resale homes and updated properties on established streets.",
          access: "Strong access to Apex services and easy enough reach to Cary and RTP.",
          amenities: "Parks, amenities, and a settled suburban feel make it easy to live in.",
          learnMoreUrl: "/explore-the-area/apex/",
          traits: { resale: 5, family: 4, schools: 4, quiet: 4, amenities: 4, establishedCharm: 4, commuteRaleigh: 3, commuteRTP: 3, value: 3, luxury: 2, outdoors: 3, trafficSensitive: 3 }
        },
        {
          suburb: "Sweetwater",
          image: "/assets/images/communities/apex.jpg",
          imageAlt: "Sweetwater in Apex",
          typeLabel: "New-construction friendly",
          group: "North Apex",
          summary: "A newer Apex option for buyers who want a more modern neighborhood with amenities and a strong lifestyle pitch.",
          why: "Best if you want new construction, good amenities, and a neighborhood that still feels like Apex.",
          homes: "New construction homes, modern townhomes, and newer residential product.",
          access: "Good access to Apex and nearby western Wake commute corridors.",
          amenities: "Community amenities, newer streetscapes, and a modern feel are the draw.",
          learnMoreUrl: "/explore-the-area/apex/",
          traits: { newConstruction: 5, amenities: 5, growth: 4, family: 4, schools: 4, lowMaintenance: 4, quiet: 3, commuteRaleigh: 3, commuteRTP: 3, value: 2, luxury: 3, outdoors: 3 }
        }
      ]
    },
    "holly-springs": {
      slug: "holly-springs",
      city: "Holly Springs",
      title: "Holly Springs Neighborhood Fit",
      intro: "Holly Springs is one of the Triangle’s strongest mix markets, with newer construction on one end and established neighborhoods and downtown character on the other.",
      heroImage: "/assets/images/communities/holly-springs.jpg",
      heroAlt: "Holly Springs neighborhoods and streets",
      quizSubject: "Your Holly Springs Neighborhood Fit Results!",
      videoUrl: "https://www.youtube-nocookie.com/embed/qqnyJVTXzB8?rel=0&modestbranding=1",
      videoTitle: "Holly Springs neighborhood video tour",
      questions: [
        makeQuestion("What kind of Holly Springs setting appeals most?", "vibe"),
        makeQuestion("Do you want brand new construction or established resale?", "newResale"),
        makeQuestion("How important are pools, trails, and neighborhood amenities?", "amenities"),
        makeQuestion("How family-focused should the neighborhood feel?", "schools"),
        makeQuestion("How much commuting flexibility do you need?", "commute"),
        makeQuestion("Would you trade some space for a newer home?", "budget"),
        makeQuestion("How much do you care about being near downtown Holly Springs?", "traffic"),
        makeQuestion("What pace feels right day to day?", "growth")
      ],
      neighborhoods: [
        {
          suburb: "Downtown Holly Springs",
          image: "/assets/images/communities/holly-springs.jpg",
          imageAlt: "Downtown Holly Springs",
          typeLabel: "Resale-heavy",
          group: "Downtown Holly Springs",
          summary: "The walkable, small-town choice for buyers who want older homes and a stronger community core.",
          why: "Best if you want a more established Holly Springs feel with real downtown character.",
          homes: "Historic and established resale homes, updated in-town properties, and character-driven streets.",
          access: "Close to downtown Holly Springs and easy to understand for day-to-day living.",
          amenities: "Local restaurants, community events, and a more compact town-center vibe define the area.",
          learnMoreUrl: "/explore-the-area/holly-springs/",
          traits: { resale: 5, walkability: 4, downtownEnergy: 4, urban: 2, establishedCharm: 4, socialLifestyle: 3, commuteRaleigh: 2, commuteRTP: 2, amenities: 4, quiet: 2, family: 3, schools: 3, value: 2 }
        },
        {
          suburb: "Twelve Oaks",
          image: "/assets/images/communities/holly-springs.jpg",
          imageAlt: "Twelve Oaks in Holly Springs",
          typeLabel: "New-construction mix",
          group: "South Holly Springs",
          summary: "A golf-centered Holly Springs community that works for buyers who want amenities and newer housing options.",
          why: "Best for buyers who want a newer or newer-feeling neighborhood with a stronger amenity package.",
          homes: "Newer single-family homes, townhomes, and amenity-driven community options.",
          access: "Good access to Holly Springs services and reasonable routes toward Raleigh.",
          amenities: "Golf, clubhouse-style amenities, and neighborhood recreation are the big pull.",
          learnMoreUrl: "/explore-the-area/holly-springs/",
          traits: { newConstruction: 4, amenities: 5, family: 4, schools: 4, quiet: 4, outdoors: 4, luxury: 3, commuteRaleigh: 2, commuteRTP: 2, growth: 4, lowMaintenance: 3, value: 3 }
        },
        {
          suburb: "Holly Glen",
          image: "/assets/images/communities/holly-springs.jpg",
          imageAlt: "Holly Glen in Holly Springs",
          typeLabel: "Resale-heavy",
          group: "South Holly Springs",
          summary: "A classic family-oriented Holly Springs neighborhood with pools, sidewalks, and a strong resale base.",
          why: "Best for buyers who want established suburban comfort and a neighborhood that already feels complete.",
          homes: "Traditional single-family homes and established resale properties.",
          access: "Easy access to central Holly Springs and the major southern Wake corridors.",
          amenities: "Pools, recreation, and family-focused neighborhood life are the story here.",
          learnMoreUrl: "/explore-the-area/holly-springs/",
          traits: { resale: 5, family: 5, schools: 4, amenities: 4, quiet: 4, space: 3, establishedCharm: 4, commuteRaleigh: 2, commuteRTP: 2, outdoors: 3, lowMaintenance: 2, value: 3 }
        },
        {
          suburb: "Sunset Ridge",
          image: "/assets/images/communities/holly-springs.jpg",
          imageAlt: "Sunset Ridge in Holly Springs",
          typeLabel: "New-construction friendly",
          group: "North Holly Springs",
          summary: "A newer Holly Springs option that gives you amenities, schools, and a very modern neighborhood profile.",
          why: "Best if you want newer construction with a full neighborhood setup and family appeal.",
          homes: "Newer single-family homes, townhomes, and modern floor plans.",
          access: "Convenient to the Holly Springs commuter network and nearby shopping.",
          amenities: "Neighborhood recreation, trails, and newer community design shape the experience.",
          learnMoreUrl: "/explore-the-area/holly-springs/",
          traits: { newConstruction: 5, amenities: 5, family: 4, schools: 4, lowMaintenance: 4, growth: 4, quiet: 4, commuteRaleigh: 2, commuteRTP: 2, outdoors: 4, value: 3 }
        },
        {
          suburb: "Braxton Village",
          image: "/assets/images/communities/holly-springs.jpg",
          imageAlt: "Braxton Village in Holly Springs",
          typeLabel: "New-construction friendly",
          group: "North Holly Springs",
          summary: "A practical newer Holly Springs neighborhood for buyers who want value, amenities, and a community feel.",
          why: "Best if you want newer homes, a family-first setup, and a better value play than the ultra-premium spots.",
          homes: "Newer single-family homes and low-maintenance community layouts.",
          access: "Good access to Holly Springs and the wider western Wake roads.",
          amenities: "Neighborhood amenities, sidewalks, and a residential feel make it easy to live in.",
          learnMoreUrl: "/explore-the-area/holly-springs/",
          traits: { newConstruction: 5, value: 4, family: 4, schools: 4, lowMaintenance: 4, quiet: 4, growth: 4, commuteRaleigh: 2, commuteRTP: 2, amenities: 4, outdoors: 3 }
        }
      ]
    }
  };

  function makeQuestion(prompt, optionSetKey) {
    const options = OPTION_SETS[optionSetKey] || [];
    return {
      prompt,
      optionSetKey,
      options: options.map((option) => ({
        label: option.label,
        traits: { ...(option.traits || {}) }
      }))
    };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initTraits() {
    const traits = {};
    TRAIT_KEYS.forEach((key) => { traits[key] = 0; });
    return traits;
  }

  function createSubmissionId() {
    return (window.crypto && typeof window.crypto.randomUUID === "function")
      ? window.crypto.randomUUID()
      : `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getTraitScore(traits, profile) {
    let score = 0;
    TRAIT_KEYS.forEach((traitKey) => {
      const weight = Number(profile[traitKey] || 0);
      if (weight) {
        score += (Number(traits[traitKey] || 0) * weight);
      }
    });
    return score;
  }

  function calculateResults(config, answerIndexes) {
    const traits = initTraits();
    config.questions.forEach((question, index) => {
      const answerIndex = answerIndexes[index];
      const option = question.options[answerIndex];
      if (!option) return;
      Object.keys(option.traits || {}).forEach((traitKey) => {
        if (traits[traitKey] == null) traits[traitKey] = 0;
        traits[traitKey] += Number(option.traits[traitKey] || 0);
      });
    });

    const ranked = config.neighborhoods
      .map((neighborhood) => ({
        ...neighborhood,
        score: getTraitScore(traits, neighborhood.traits || {})
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return ranked.map((item, index) => ({
      rank: index + 1,
      label: index === 0 ? "Top Pick" : "Also Consider",
      suburb: item.suburb,
      neighborhood: item.suburb,
      typeLabel: item.typeLabel,
      summary: item.summary,
      why: item.why,
      homes: item.homes,
      access: item.access,
      amenities: item.amenities,
      learnMoreUrl: item.learnMoreUrl,
      image: item.image,
      imageAlt: item.imageAlt || item.suburb
    }));
  }

  function buildAnswerPayload(config, answers) {
    return config.questions.map((question, index) => {
      const answerIndex = answers[index];
      const option = question.options[answerIndex];
      return {
        questionNumber: index + 1,
        question: question.prompt,
        selectedOptionIndex: Number.isInteger(answerIndex) ? answerIndex : null,
        selectedOptionText: option ? option.label : null
      };
    });
  }

  function renderQuiz(root, config) {
    const state = {
      current: 0,
      answers: new Array(config.questions.length).fill(null),
      results: [],
      submissionId: "",
      submitInFlight: false
    };

    root.innerHTML = `
      <div class="neighborhood-fit-shell">
        <div class="neighborhood-fit-hero">
          <div class="neighborhood-fit-hero-copy">
            <p class="neighborhood-fit-script">Find Your Neighborhood Fit</p>
            <h2>${escapeHtml(config.city)} Neighborhood Fit Quiz</h2>
            <p>${escapeHtml(config.intro)}</p>
            <div class="neighborhood-fit-points">
              <div class="neighborhood-fit-point"><strong>8 questions</strong><span>to narrow the field fast</span></div>
              <div class="neighborhood-fit-point"><strong>3 top neighborhoods</strong><span>based on your answers</span></div>
              <div class="neighborhood-fit-point"><strong>Resale-first or mix</strong><span>depending on the city</span></div>
            </div>
          </div>
          <div class="neighborhood-fit-hero-media">
            <img src="${escapeHtml(config.heroImage)}" alt="${escapeHtml(config.heroAlt)}" loading="eager">
          </div>
        </div>

        <div class="neighborhood-fit-card" id="quizStage">
          <div class="neighborhood-fit-progress-row">
            <span id="quizStepLabel">Question 1 of ${config.questions.length}</span>
            <span id="quizPercent">${Math.round(100 / config.questions.length)}%</span>
          </div>
          <div class="neighborhood-fit-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(100 / config.questions.length)}" aria-label="Quiz progress">
            <div class="neighborhood-fit-progress-fill" id="quizProgressFill" style="width:${Math.round(100 / config.questions.length)}%"></div>
          </div>
          <h3 class="neighborhood-fit-question" id="quizQuestion"></h3>
          <div class="neighborhood-fit-options" id="quizOptions"></div>
          <div class="neighborhood-fit-nav">
            <button class="neighborhood-fit-btn" id="prevBtn" type="button">Previous</button>
            <div class="neighborhood-fit-next-wrap is-disabled" id="nextWrap">
              <button class="neighborhood-fit-btn" id="nextBtn" type="button">Next</button>
              <span class="neighborhood-fit-tooltip">Please select an option first.</span>
            </div>
          </div>
        </div>

        <section class="neighborhood-fit-results" id="quizResults" hidden aria-live="polite"></section>

        <section class="neighborhood-fit-lead-gate" id="leadGate" hidden>
          <div class="neighborhood-fit-lead-copy">
            <p class="neighborhood-fit-script">Your results are ready</p>
            <h2>Get your ${escapeHtml(config.city)} match delivered by email.</h2>
            <p>Leave your information below and we’ll send your top three neighborhood matches to your inbox.</p>
          </div>
          <form class="neighborhood-fit-form" id="leadForm" novalidate>
            <div class="neighborhood-fit-form-grid">
              <label class="neighborhood-fit-field"><span>First name</span><input type="text" name="firstName" autocomplete="given-name" required></label>
              <label class="neighborhood-fit-field"><span>Last name</span><input type="text" name="lastName" autocomplete="family-name" required></label>
              <label class="neighborhood-fit-field full"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>
              <label class="neighborhood-fit-field full neighborhood-fit-checkbox-row">
                <input type="checkbox" name="wantsConsultation" id="wantsConsultation">
                <span>I would like to speak with the Living in Raleigh team about my results.</span>
              </label>
              <label class="neighborhood-fit-field full neighborhood-fit-phone-conditional" id="phoneConditional">
                <span>Phone</span>
                <input type="tel" name="phone" id="phoneInput" autocomplete="tel">
              </label>
            </div>
            <div class="neighborhood-fit-submit-wrap">
              <div class="neighborhood-fit-submit-tooltip">Please complete the form to continue.</div>
              <button class="neighborhood-fit-submit" type="submit">Send My Results</button>
            </div>
            <p class="neighborhood-fit-msg" id="formMsg" hidden></p>
          </form>
        </section>

        <section class="neighborhood-fit-success" id="quizSuccessScreen" hidden>
          <div>
            <h2>Success. Check your email now.</h2>
            <p>Your neighborhood fit results are on the way. Redirecting home in a few seconds.</p>
          </div>
        </section>
      </div>
    `;

    const el = {
      stage: root.querySelector("#quizStage"),
      results: root.querySelector("#quizResults"),
      leadGate: root.querySelector("#leadGate"),
      success: root.querySelector("#quizSuccessScreen"),
      question: root.querySelector("#quizQuestion"),
      options: root.querySelector("#quizOptions"),
      stepLabel: root.querySelector("#quizStepLabel"),
      percent: root.querySelector("#quizPercent"),
      fill: root.querySelector("#quizProgressFill"),
      prev: root.querySelector("#prevBtn"),
      nextWrap: root.querySelector("#nextWrap"),
      next: root.querySelector("#nextBtn"),
      form: root.querySelector("#leadForm"),
      formMsg: root.querySelector("#formMsg"),
      submit: root.querySelector(".neighborhood-fit-submit"),
      wantsConsultation: root.querySelector("#wantsConsultation"),
      phoneConditional: root.querySelector("#phoneConditional"),
      phoneInput: root.querySelector("#phoneInput"),
      submitWrap: root.querySelector(".neighborhood-fit-submit-wrap")
    };

    function renderQuestion() {
      const question = config.questions[state.current];
      const progress = Math.round(((state.current + 1) / config.questions.length) * 100);

      el.stepLabel.textContent = `Question ${state.current + 1} of ${config.questions.length}`;
      el.percent.textContent = `${progress}%`;
      el.fill.style.width = `${progress}%`;
      el.fill.parentElement.setAttribute("aria-valuenow", String(progress));
      el.question.textContent = question.prompt;
      el.options.innerHTML = "";

      question.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "neighborhood-fit-option";
        button.innerHTML = `<strong>${String.fromCharCode(65 + index)}.</strong> ${escapeHtml(option.label)}`;
        if (state.answers[state.current] === index) {
          button.classList.add("is-selected");
        }
        button.addEventListener("click", () => {
          state.answers[state.current] = index;
          renderQuestion();
        });
        el.options.appendChild(button);
      });

      el.prev.disabled = state.current === 0;
      el.next.textContent = state.current === config.questions.length - 1 ? "Finish" : "Next";
      const unanswered = state.answers[state.current] === null;
      el.next.disabled = unanswered;
      el.nextWrap.classList.toggle("is-disabled", unanswered);
    }

    function syncConsultationPhoneField() {
      const wantsConsultation = Boolean(el.wantsConsultation && el.wantsConsultation.checked);
      if (el.phoneConditional) el.phoneConditional.classList.toggle("active", wantsConsultation);
      if (el.phoneInput) {
        el.phoneInput.required = wantsConsultation;
        if (!wantsConsultation) {
          el.phoneInput.value = "";
        }
      }
      syncSubmitState();
    }

    function syncSubmitState() {
      if (!el.submit) return;
      const valid = el.form ? el.form.checkValidity() : false;
      el.submit.disabled = !valid;
      el.submitWrap.classList.toggle("is-disabled", !valid);
    }

    function showResults() {
      const resultCards = calculateResults(config, state.answers);
      state.results = resultCards;
      const cardsHtml = resultCards.map((result) => `
        <article class="neighborhood-fit-result-card">
          <div class="neighborhood-fit-result-media">
            <img src="${escapeHtml(result.image)}" alt="${escapeHtml(result.imageAlt)}" loading="lazy">
          </div>
          <div class="neighborhood-fit-result-body">
            <div class="neighborhood-fit-result-badges">
              <span class="neighborhood-fit-result-badge ${result.rank === 1 ? "is-top" : ""}">${escapeHtml(result.label)}</span>
              <span class="neighborhood-fit-result-badge is-muted">${escapeHtml(result.typeLabel || "Neighborhood fit")}</span>
            </div>
            <h4>${escapeHtml(result.suburb)}</h4>
            <p class="neighborhood-fit-result-summary">${escapeHtml(result.summary)}</p>
            <p><strong>Why it fits:</strong> ${escapeHtml(result.why)}</p>
            <p><strong>Homes you usually see:</strong> ${escapeHtml(result.homes)}</p>
            <p><strong>Access:</strong> ${escapeHtml(result.access)}</p>
            <p><strong>Amenities:</strong> ${escapeHtml(result.amenities)}</p>
            <a class="neighborhood-fit-result-link" href="${escapeHtml(result.learnMoreUrl)}" target="_blank" rel="noopener noreferrer">Learn More</a>
          </div>
        </article>
      `).join("");

      el.results.innerHTML = `
        <div class="neighborhood-fit-results-head">
          <div>
            <p class="neighborhood-fit-script">Your neighborhood match</p>
            <h3>${escapeHtml(config.city)} top three neighborhoods</h3>
          </div>
          <p class="neighborhood-fit-results-copy">We matched your answers to the neighborhoods below. The top result is your best fit, and the other two are the next closest matches.</p>
        </div>
        <div class="neighborhood-fit-results-grid">${cardsHtml}</div>
      `;
      el.results.hidden = false;
    }

    function showSuccessAndRedirect() {
      root.querySelector(".neighborhood-fit-shell").classList.add("quiz-complete");
      el.stage.hidden = true;
      el.results.hidden = true;
      el.leadGate.hidden = true;
      el.success.hidden = false;
      window.setTimeout(() => {
        window.location.assign("/");
      }, QUIZ_SUCCESS_REDIRECT_MS);
    }

    function getLeadFormState() {
      if (!el.form) return null;
      const data = new FormData(el.form);
      return {
        firstName: String(data.get("firstName") || ""),
        lastName: String(data.get("lastName") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        wantsConsultation: data.get("wantsConsultation") === "on"
      };
    }

    function getOrCreateSubmissionId() {
      if (!state.submissionId) {
        state.submissionId = createSubmissionId();
      }
      return state.submissionId;
    }

    function buildLeadPayload() {
      const formData = new FormData(el.form);
      const results = state.results.length ? state.results : calculateResults(config, state.answers);
      const answers = buildAnswerPayload(config, state.answers);
      const answerPayload = {
        quizType: "neighborhood_fit",
        quiz_type: "neighborhood_fit",
        quizSlug: config.slug,
        quiz_slug: config.slug,
        quizCity: config.city,
        quiz_city: config.city,
        quizTitle: config.title,
        quiz_title: config.title,
        quizSubject: config.quizSubject,
        quiz_subject: config.quizSubject,
        quiz_results_json: results,
        quiz_answers_json: answers
      };

      return {
        ...answerPayload,
        lead_type: "suburb_quiz",
        source_page: config.sourcePage,
        source_key: config.sourcePage,
        submitted_at: new Date().toISOString(),
        submission_id: getOrCreateSubmissionId(),
        first_name: String(formData.get("firstName") || "").trim(),
        last_name: String(formData.get("lastName") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        wantsConsultation: formData.get("wantsConsultation") === "on",
        results,
        answers
      };
    }

    async function postLead(payload) {
      if (!LEAD_CAPTURE_ENDPOINT) return;
      await fetch(LEAD_CAPTURE_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
        keepalive: true
      });
    }

    function nextQuestionOrFinish() {
      if (state.current < config.questions.length - 1) {
        state.current += 1;
        renderQuestion();
        return;
      }

      showResults();
      el.stage.hidden = true;
      el.results.hidden = false;
      el.leadGate.hidden = false;
      syncConsultationPhoneField();
      syncSubmitState();
    }

    function sendAnalytics(topPick) {
      if (!ANALYTICS_ENDPOINT) return;
      fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "neighborhood_fit_quiz_submit",
          quizSlug: config.slug,
          quizCity: config.city,
          submittedAt: new Date().toISOString(),
          answerCount: state.answers.length,
          topPick
        })
      }).catch(() => {});
    }

    el.prev.addEventListener("click", () => {
      if (state.current > 0) {
        state.current -= 1;
        renderQuestion();
      }
    });

    el.next.addEventListener("click", () => {
      if (el.next.disabled) {
        return;
      }
      nextQuestionOrFinish();
    });

    el.nextWrap.addEventListener("click", () => {
      if (!el.next.disabled) return;
      el.nextWrap.classList.add("show-tooltip");
      window.setTimeout(() => el.nextWrap.classList.remove("show-tooltip"), 1200);
    });

    if (el.wantsConsultation) {
      el.wantsConsultation.addEventListener("change", () => {
        syncConsultationPhoneField();
      });
    }

    if (el.form) {
      el.form.addEventListener("input", syncSubmitState);
      el.form.addEventListener("change", syncSubmitState);
    }

    if (el.form) {
      el.form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (state.submitInFlight) return;
        if (!el.form.reportValidity()) return;

        state.submitInFlight = true;
        el.submit.disabled = true;
        el.formMsg.hidden = true;
        el.formMsg.textContent = "";

        const payload = buildLeadPayload();
        try {
          await postLead(payload);
          sendAnalytics(payload.results && payload.results[0] ? payload.results[0].suburb : "unknown");
          showSuccessAndRedirect();
        } catch (error) {
          state.submitInFlight = false;
          el.formMsg.hidden = false;
          el.formMsg.textContent = "We hit a connection issue. Your answers are still here - please try again in a moment.";
          syncSubmitState();
        }
      });
    }

    renderQuestion();
    syncConsultationPhoneField();
    syncSubmitState();
  }

  function renderVideo(root, config) {
    root.innerHTML = `
      <div class="neighborhood-fit-video-shell">
        <div class="neighborhood-fit-video-head">
          <p class="neighborhood-fit-script">Neighborhood video tour</p>
          <h2>${escapeHtml(config.videoTitle || `${config.city} neighborhood video tour`)}</h2>
        </div>
        <div class="neighborhood-fit-video-frame">
          <iframe
            src="${escapeHtml(config.videoUrl)}"
            title="${escapeHtml(config.videoTitle || `${config.city} neighborhood video tour`)}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    `;
  }

  document.querySelectorAll("[data-neighborhood-fit-quiz]").forEach((node) => {
    const slug = String(node.getAttribute("data-neighborhood-fit-quiz") || "").toLowerCase();
    const config = QUIZZES[slug];
    if (config) {
      renderQuiz(node, config);
    }
  });

  document.querySelectorAll("[data-neighborhood-fit-video]").forEach((node) => {
    const slug = String(node.getAttribute("data-neighborhood-fit-video") || "").toLowerCase();
    const config = QUIZZES[slug];
    if (config) {
      renderVideo(node, config);
    }
  });
})();
