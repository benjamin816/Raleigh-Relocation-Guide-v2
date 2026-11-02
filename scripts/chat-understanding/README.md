# Test chat language interpretation

The Test website uses `assets/js/raleigh-chat-understanding.js` before the existing
conversation engine. AI interprets a message; the existing engine writes replies
and controls qualification, consent, contacts and calendar calls. This is not a
generative replacement of Sam's approved talk tracks.

## Deployment

Worker: `lir-chat-understanding-test`

Endpoint: `https://lir-chat-understanding-test.benjamin-raleighrealtor.workers.dev/interpret`

Status: `/status` with an allowed Origin header.

Model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, on the account's verified Workers
Free plan. No paid plan or billing method was added. At the free daily AI limit,
inference fails and the client uses the existing bot. The 12-per-minute IP limit
also falls back. Rate limiting is approximate, not an authentication mechanism.

Only `http://127.0.0.1:8777` and `http://localhost:8777` are allowed. Production
origins are explicitly rejected. The browser also gates AI to the local Test
surface. The existing live booking/admin relay is a separate, unchanged Worker.
This interpreter has no Calendar, Sheet, email or booking credentials/routes.

Build the approved-flow playbook after changing the chat configuration:

```
node scripts/chat-understanding/build-knowledge.cjs
npx wrangler deploy --config scripts/chat-understanding/wrangler.jsonc
```

Wrangler requires a deployment credential. Never put one in this repository or
in browser code. The temporary account deployment token used for this rollout
expires November 3, 2026. Runtime inference uses Cloudflare's AI binding, so the
deployment credential is not required for normal chatbot operation.

## Interpretation boundaries

- Names requested by the bot and booking/contact form values bypass AI. Questions
  interrupting those prompts can use AI without being stored as form answers. Email
  and phone patterns are also excluded/redacted from interpretation context.
  Attachments never enter the interpretation service.
- Only short recent history and selected known facts are included. Requests and
  responses are not persisted by the Worker; Worker observability is disabled.
- Original text remains visible in chat. Canonical text is a parsing aid only.
  The structured question/human/preamble signal is also carried into routing.
  Questions must not become names or qualification answers. AI can choose only
  an answer ID from the approved FAQ/information catalog, never generate advice.
  The deployed knowledge version must match the client's configured version.
- Raw safety classification and explicit contact/scheduling refusals take
  precedence. Numeric changes, known budget rewrites, financing reversals,
  negative pre-approval reversals and unsupported output fail closed.
- Booking time selections and all actual calendar checks remain deterministic.
  The model cannot provide a start time or submit a booking.
- Unrelated answers become clarification, not invented qualification facts.
- Clear buy/sell answers and greetings use the existing parser immediately and
  cannot be rejected by a model's uncertain classification. Price answers to a
  budget question also bypass inference. Other AI calls have a 4-second ceiling;
  the natural reply pause runs from the original send time, not AI completion.
- A first greeting introduces Sam and asks for a name. A subtle Read receipt
  appears below the latest user bubble after processing, before the delayed reply.
- Timeout, quota, invalid JSON, invalid interpretation and network failures use
  the existing rules. A short circuit breaker avoids repeatedly waiting for an
  unavailable provider. Reset cancels requests and discards stale results.

## Verification

```
node scripts/chat-understanding/worker.test.mjs
node tests/chat-understanding.test.cjs
node tests/chat-bounded-regressions.test.cjs
node tests/chat-understanding-live.cjs
node tests/chat-ai-detours.test.cjs
node tests/chat-ai-dialogue-live.cjs
```

The unit/regression commands are isolated. `chat-understanding-live.cjs` makes
ten actual inference requests. `chat-ai-dialogue-live.cjs` runs the frozen 20
dialogues against real inference, including protected/rules and fallback turns.
Both live runners mock calendar, lead, email and upload boundaries. Neither books
a real event. Set `CHAT_DIALOGUE_IDS` to rerun named cases without changing them.
An optional local `output/chat-understanding/pre-detour-widget.js` snapshot
provides the old-routing comparison; missing baseline comparisons are null.

Live results, original smaller-model trial results and Chrome verification
artifacts are in `output/chat-understanding/`. The initial smaller model was
rejected after live evaluation. The earlier ten-sample test was insufficient:
the follow-up 20-dialogue/80-turn test exposed failures in the 8B model and its
question-routing integration. Those results are preserved, rather than replaced
by later successful results. See the dialogue report for the larger-model review.
No finite sample proves all possible messages will be understood.

The final retained review passes all 20 dialogues / 80 turns: 45 AI-interpreted,
32 protected/direct-rule turns, and 3 safe fallback turns. The 8B run passed
13/20. The larger model with the too-short timeout passed 17/20; all ten cases
affected by that timeout were rerun at four seconds. Successful initial cases
were retained. These are not fresh unseen rounds or a population accuracy rate.
All 80 captured-frame turns are retained in `chat-ai-dialogue-replay.test.cjs`.

**Chat appointment creation remains paused in the existing booking service.**
This rollout does not restore it or deploy the pending short-referral service.
