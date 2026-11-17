const sections = [
  {
    "title": "Client Questionnaire",
    "questions": []
  },
  {
    "title": "Contact Information",
    "questions": [
      {
        "id": "name",
        "label": "Name",
        "type": "text",
        "options": null,
        "note": "First and Last Name (Feel free to also include a nickname if you go by something else!)"
      },
      {
        "id": "email",
        "label": "Email address used to book your call",
        "type": "email",
        "options": null,
        "note": "Use the same email so we can match your answers to your meeting."
      },
      {
        "id": "partner",
        "label": "Spouse or partner's contact information",
        "type": "partner",
        "options": null,
        "note": null
      },
      {
        "id": "contact",
        "label": "Preferred Contact Method",
        "type": "checkbox",
        "options": [
          "Text",
          "Email",
          "Call",
          "All of the Above!"
        ],
        "note": null
      },
      {
        "id": "times",
        "label": "Best Days/Times to Reach You. Please note your time zone if not EST.",
        "type": "textarea",
        "options": null,
        "note": null
      }
    ]
  },
  {
    "title": "The Vision",
    "questions": [
      {
        "id": "dream",
        "label": "Please list the 7 most important qualifications in your dream home (in order from most to least important ideally)",
        "type": "textarea",
        "options": null,
        "note": "e.g. location, schools, bed/bath, sq ft, no hoa, hoa, large backyard, 2 story vs 1 story, want a basement, near x school, price range, etc."
      },
      {
        "id": "nice",
        "label": "What are things you'd love to see if your home but can live without if it checks your other boxes?",
        "type": "textarea",
        "options": null,
        "note": null
      },
      {
        "id": "schools",
        "label": "If there are specific schools, school districts, suburbs, or neighborhoods that you know you want to be - list them here!",
        "type": "textarea",
        "options": null,
        "note": null
      },
      {
        "id": "commute",
        "label": "Do you have a specific commute you are looking at accomplish. Please include relevant commute goal + work location(s) if applicable.",
        "type": "textarea",
        "options": null,
        "note": null
      },
      {
        "id": "condition",
        "label": "Are you looking for move-in ready or are you okay with some work being needed? Please note if only looking for new construction!",
        "type": "radio",
        "options": [
          "Only Looking at New Homes",
          "Okay with Cosmetic Repairs Needing Done",
          "Need Move-in Ready"
        ],
        "note": "Note: We can get our trusted vendors in day after closing to knock out fresh paint, new carpet/flooring, and whatever else may be needed!"
      }
    ]
  },
  {
    "title": "Process",
    "questions": [
      {
        "id": "timeline",
        "label": "What is your ideal timeline? And what does that timeline depend on?",
        "type": "textarea",
        "options": null,
        "note": "Did you know? It takes 2-3 months on average from looking at homes to get to the closing table!"
      },
      {
        "id": "sell",
        "label": "Do you have a house to sell?",
        "type": "radio",
        "options": [
          "Yes",
          "No, I Rent",
          "I Own and Intend to Rent It Out",
          "No, I have short-term housing or am staying with family (no lease concerns)"
        ],
        "note": null
      }
    ]
  },
  {
    "title": "Process Continued",
    "questions": [
      {
        "id": "lease",
        "label": "When does your lease end? And are you comfortable with terminating early for the right house?",
        "type": "textarea",
        "options": null,
        "note": "Note: Most will allow early termination in exchange for a fee, are you aware of your specific policy?"
      }
    ]
  },
  {
    "title": "Own Your Home",
    "questions": []
  },
  {
    "title": "Financing",
    "questions": [
      {
        "id": "finance",
        "label": "How do you plan to purchase your home?",
        "type": "radio",
        "options": [
          "Financing",
          "Cash",
          "Could go either way"
        ],
        "note": null
      },
      {
        "id": "cashSaleDependent",
        "label": "Is your cash purchase dependent on the completed sale of your current home?",
        "type": "radio",
        "options": [
          "Yes",
          "No",
          "Unsure"
        ]
      },
      {
        "id": "sellfirst",
        "label": "Do you need to sell your current home before buying?",
        "type": "radio",
        "options": [
          "Yes",
          "No",
          "Unsure"
        ]
      },
      {
        "id": "budget",
        "label": "Do you have a monthly mortgage payment or purchase price range in mind already? We will work together to make sure this aligns with what you are looking for.",
        "type": "textarea",
        "options": null,
        "note": null
      },
      {
        "id": "lender",
        "label": "Have you spoken with a lender? If so, please kindly provide their name and number, alongside the company. Please also include your pre-approval amount if applicable.",
        "type": "textarea",
        "options": null,
        "note": null
      }
    ]
  },
  {
    "title": "Final Questions",
    "questions": [
      {
        "id": "agent",
        "label": "What are you looking for in your ideal real estate agent?",
        "type": "textarea",
        "options": null,
        "note": null
      },
      {
        "id": "source",
        "label": "How did you hear about our services?",
        "type": "radio",
        "options": [
          "YouTube",
          "Referral",
          "Google",
          "Instagram",
          "Other"
        ],
        "note": null
      }
    ]
  },
  {
    "title": "YouTube",
    "questions": [
      {
        "id": "video",
        "label": "Was There a Specific YouTube Video That Made You Want to Reach Out?",
        "type": "textarea",
        "options": null,
        "note": null
      }
    ]
  },
  {
    "title": "Wrapping Up",
    "questions": [
      {
        "id": "questions",
        "label": "What questions do you have for us, or is there anything else you would like us to know?",
        "type": "textarea",
        "options": null,
        "note": null
      }
    ]
  }
];
