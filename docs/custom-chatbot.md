# Custom Raleigh chat (TEST branch)

The chat widget is a static, dependency-free, rule-based guide. It does not use Tawk, an LLM, a paid API, or any external chatbot service. Its text, keywords, answer choices, branch order, and booking URLs are editable in `assets/js/raleigh-chat-config.js`. The rendering and branching engine is `assets/js/raleigh-chat.js`; styles are in `assets/css/raleigh-chat.css`.

The widget runs on pages that load the shared `assets/js/script.js`, plus the standalone `/invest/` page. It is intentionally hidden on `/consult/` and `/2026/` to avoid competing with those focused forms. The generated fictional avatar is `assets/images/chat/raleigh-guide-avatar.png`. It should not be represented as a real employee or live agent. Chat messages and qualification answers exist only in page memory and disappear on reload.

## Lead handoff and required backend

This repository is hosted as a static GitHub Pages site. Its existing lead forms POST to Google Apps Script in `no-cors` mode, which gives the browser an opaque response. A chat cannot confirm that such a POST was accepted or stored. The TEST implementation therefore does **not** claim in-chat lead storage: the contact step opens a user-initiated email draft, and clearly says the visitor must press Send in their mail app. Booking links remain available for both general and investing conversations.

To enable verified in-chat submissions, deploy a same-origin HTTPS endpoint and set `leadEndpoint` to its path in the config. The engine expects `POST` JSON with `source`, `source_page`, `intent`, `answers`, `name`, `email`, `phone`, `question`, and `consent`; it requires a 2xx JSON response containing `{"ok":true}` before showing success. The backend should validate all fields, enforce consent, rate-limit and spam-protect submissions, store the lead server-side or forward it securely to the existing CRM, and keep all credentials server-side. Do not put CRM keys in JavaScript or treat a `no-cors` response as proof of storage. Until this backend is deployed and tested, leave `leadEndpoint: null`.

The optional React Flow starter kit is an editor for creating flow diagrams, not a compact runtime for this static site. The current editable config covers the four requested workflows without adding React or a build step.

## Smoke test

1. Open the TEST site on desktop and mobile. Confirm the green launcher has a hover/focus shadow, the chat fills a narrow mobile screen, and Escape or close returns focus to the launcher.
2. Try all four topic chips and each two-question branch. Check the general and investing booking URLs.
3. Type a free-form intent (such as “I want to sell my home”) and a free-form answer within a branch.
4. Open the contact step. With no backend, verify it says “Open my email app” and does not claim the lead was stored.
5. Confirm no request to `embed.tawk.to` appears in network activity.
