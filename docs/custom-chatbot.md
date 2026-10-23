# Custom Raleigh chat (TEST branch)

The website chat is a static, dependency-free, rule-based guide. It does not use Tawk, an LLM, a paid API, or an external chatbot platform. Its scripts, keywords, answer choices, branch order, and booking URLs live in `assets/js/raleigh-chat-config.js`. The runtime is `assets/js/raleigh-chat.js`; styles are in `assets/css/raleigh-chat.css`.

Open the local flow editor at `/tools/chat-flow-editor/`. It displays the four paths and lets you edit intent keywords, responses, qualification questions, answer buttons, and booking destination. The editor is a TEST authoring tool, not a visitor-facing page. Chrome's **Save flow file** button prompts you to choose the repository's `assets/js/raleigh-chat-config.js`; refresh the site tab afterward. It does not modify the chat until that file is saved.

The widget runs on pages that load `assets/js/script.js`, plus the standalone `/invest/` page. It is hidden on `/consult/` and `/2026/` to avoid competing with those forms. The generated fictional avatar is `assets/images/chat/raleigh-guide-avatar.png`. It should not be represented as a real team member or live agent. Routine chat messages and qualification answers exist only in page memory; only an explicit contact request is transmitted.

## Lead storage

The contact form sends name, email, phone, interest, question, and conversation context over HTTPS to the site's **existing** Google Apps Script website lead receiver. The receiver appends the canonical row to the private `Master Leads` spreadsheet's `Website Direct Leads` tab. Submissions are identified by `source_key=website_rule_chat`. The new **Website Chat Leads** tab in that same spreadsheet is a filtered view of those rows; it updates without another Apps Script deployment. The tab is not a second independent database.

The endpoint is cross-origin and used in `no-cors` mode, as with the existing website forms. The browser can detect a network failure but cannot read the Apps Script response or prove that a particular row was stored. The UI says “submitted for processing,” not “received by our team.” Each retry reuses one submission ID so the receiver can deduplicate it. The existing receiver sends admin email only when a phone number is present, so the chat form requires phone.

An end-to-end synthetic POST on October 23, 2026 returned `ok:true`, appeared on the new tab with the expected fields, and was then removed from the source sheet. This validates the route and tab formula, not per-visitor acknowledgement. Before promoting to main, add server-side input validation, formula-injection protection, rate limiting/spam controls, and a readable acknowledgement route if confirmed delivery is required. The existing receiver routes all chat interests to this one Master Leads sheet; investor chats are labeled as investing but **not yet segregated into the separate Investor Master Lead Sheet or investor notification workflow**. Do not promote this chat to main until that audience separation is addressed.

## Smoke test

1. Open the local TEST site and flow editor. Confirm the editor has four paths, editable questions, and Save flow file.
2. Open the chat on desktop and mobile. Confirm the green launcher, hover/focus shadow, full-screen narrow layout, and Escape/close focus behavior.
3. Try all four topic choices, free-form intent detection, qualification choices, and general/investing booking links.
4. Submit a synthetic contact request through a network-intercepted browser test. Verify `source_key=website_rule_chat`, interest, question/context, and that no mail client opens.
5. For a real end-to-end storage test, use a clearly marked synthetic submission with no phone so it sends no admin alert, verify it on the Sheet's chat tab, then remove only that test row.
6. Confirm no request to `embed.tawk.to` appears in network activity.
