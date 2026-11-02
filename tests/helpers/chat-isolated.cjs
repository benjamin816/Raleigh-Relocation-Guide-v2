const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '../..');
const sourceFiles = {
  chat: path.join(repo, 'assets/js/raleigh-chat.js'),
  config: path.join(repo, 'assets/js/raleigh-chat-config.js'),
  engine: path.join(repo, 'assets/js/raleigh-chat-engine.js')
};
const source = fs.readFileSync(sourceFiles.chat, 'utf8');
const configSandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(sourceFiles.config, 'utf8'), configSandbox);
const baseConfig = configSandbox.window.RaleighChatConfig;
const engine = require(sourceFiles.engine);

const bounds = [...source.matchAll(/^  function ([\w]+)\(/gm)];
const funcs = {};
for (let i = 0; i < bounds.length; i++) {
  funcs[bounds[i][1]] = source.slice(bounds[i].index, i + 1 < bounds.length ? bounds[i + 1].index : source.length);
}

const conversationFunctions = [
  'informationalGuidance', 'informationalReply', 'requestContactPermission', 'resumeAfterQuestion', 'answerSideQuestion', 'memorySummary', 'offerBrowsingHelp', 'showContact', 'handleContactAnswer', 'applyKnownFacts', 'knownAnswer', 'activeQuestions', 'detectIntent', 'startFlow',
  'routeRentalPlan', 'routeSellerReferral', 'locationAcknowledgement', 'originLabel', 'askQuestion', 'answerAcknowledgement',
  'explainRentalOnly', 'asksToRent', 'mentionsPrice', 'priceAmount', 'homeDetailCount',
  'captureVisitorContext', 'markPreapproval', 'acceptAnswer', 'handleText',
  'isQuestionPreamble', 'asksForBenjaminNumber', 'asksForTeamMember',
  'asksToMeetNamedHost', 'requestedPerson'
];
const bookingFunctions = [
  'bookingToken', 'bookingLabel', 'bookingDayKey', 'bookingSlotParts', 'requestedClock',
  'bookingPreferenceFromText', 'hasBookingPreference', 'offeredBookingChoice',
  'normalizeSuggestedTime', 'bookingFailed', 'showBookingPair', 'offerBookingSlots',
  'startBooking', 'loadBookingSlots', 'handleBookingAnswer'
];
for (const name of [...conversationFunctions, ...bookingFunctions]) assert(funcs[name], `missing application function ${name}`);

const deterministicSlots = [
  { start: '2026-11-05T18:00:00.000Z', referralMinutes: 15, daypart: 'afternoon', availableHosts: ['Benjamin', 'Ricardo'] },
  { start: '2026-11-06T22:00:00.000Z', referralMinutes: 15, daypart: 'evening', availableHosts: ['Benjamin', 'Ricardo'] },
  { start: '2026-11-07T15:00:00.000Z', referralMinutes: 15, daypart: 'morning', availableHosts: ['Benjamin'] },
  { start: '2026-11-07T18:00:00.000Z', referralMinutes: 15, daypart: 'afternoon', availableHosts: ['Ricardo'] }
];

const tick = () => new Promise(resolve => setImmediate(resolve));
async function settle() { await tick(); await tick(); }

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createSession(id, metadata) {
  const config = clone(baseConfig);
  config.bookingRelayUrl = 'https://blocked.invalid/booking';
  config.bookingBridgeUrl = '';
  config.leadEndpoint = '';
  config.chatAttachmentsEnabled = false;

  const messages = [];
  const transcript = [];
  const serviceCalls = [];
  const blockedAttempts = [];
  const events = [];
  const analytics = [];
  const storage = [];
  let tokenCounter = 0;
  let poisoned = false;

  const state = {
    intent: null, combined: false, question: -1, answers: [], profile: {}, memories: {},
    memoryProfiles: {}, previousInput: '', ended: false, history: [], booking: null
  };

  function block(kind, detail) {
    const attempt = { kind, detail: detail === undefined ? null : clone(detail), atTurn: transcript.length };
    blockedAttempts.push(attempt);
    poisoned = true;
    throw new Error(`ISOLATION_FAILURE:${kind}`);
  }

  function bookingCall(method, args) {
    const captured = clone(args || []);
    serviceCalls.push({ boundary: 'bookingCall', method, args: captured, atTurn: transcript.length });
    if (method === 'slots') {
      // Model the service's filtering contract, rather than returning Thursday
      // when the application explicitly requested Friday.
      const preference=captured[0]||{};
      const slots=clone(deterministicSlots).filter(slot=>{
        const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'long'}).formatToParts(new Date(slot.start)).map(p=>[p.type,p.value]));
        const day=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(parts.weekday);
        return (!preference.host||slot.availableHosts.includes(preference.host)) &&
          (!preference.weekdays?.length||preference.weekdays.includes(day)) &&
          (!preference.date||preference.date===`${parts.year}-${parts.month}-${parts.day}`) &&
          (!preference.daypart||slot.daypart===preference.daypart);
      });
      if(metadata && metadata.legacyBookingService)slots.forEach(slot=>delete slot.referralMinutes);
      return Promise.resolve(slots);
    }
    if (method === 'suggest') return Promise.resolve({ available: false });
    if (method === 'book') {
      const payload = captured[0] || {};
      return Promise.resolve({
        booked: true,
        start: payload.start,
        assignedHost: 'Benjamin',
        callType: payload.callType,
        videoUrl: payload.callType === 'video' ? 'https://meet.example.test/safe' : ''
      });
    }
    return Promise.reject(new Error(`Unexpected booking method ${method}`));
  }

  const safeDocument = {
    visibilityState: 'visible', activeElement: null,
    createElement(tag) { return block('document.createElement', { tag }); },
    querySelector() { return null; },
    addEventListener() {},
    body: { appendChild(node) { return block('document.body.appendChild', { nodeType: node && node.tagName }); } }
  };
  const safeLocation = {
    href: 'https://localhost.test/',
    assign(url) { return block('location.assign', { url }); },
    replace(url) { return block('location.replace', { url }); }
  };
  const safeNavigator = { sendBeacon(url, data) { return block('navigator.sendBeacon', { url, hasData: !!data }); } };

  const context = {
    engine, config, state, console, Date, Intl, input: {}, sendButton: {}, lastUserSentAt: 0,
    attachment: null, attachmentInput: { value: '' }, document: safeDocument, navigator: safeNavigator,
    message(text, isUser, options) { if (!isUser) messages.push(String(text)+(options && options.link ? ` [LINK] ${options.link.label} -> ${options.link.href}` : '')); state.history.push({text:String(text),byUser:!!isUser,at:new Date().toISOString()}); },
    link(label, href) { messages.push(`[LINK] ${label} -> ${href}`); },
    bookingCall,
    redact: text => text,
    scheduleClarification: text => messages.push(`[CLARIFY] ${text}`),
    trackConversation: eventName => analytics.push({ eventName, atTurn: transcript.length }),
    submitBookingAttachment: (...args) => block('submitBookingAttachment', { argCount: args.length }),
    submitContact: (...args) => block('submitContact', { argCount: args.length }),
    readAttachment: (...args) => block('readAttachment', { argCount: args.length }),
    showAttachment() {},
    finishConversation() { state.completed = true; },
    fetch: (...args) => block('fetch', { url: String(args[0]) }),
    XMLHttpRequest: function () { return block('XMLHttpRequest', null); },
    WebSocket: function (url) { return block('WebSocket', { url }); },
    EventSource: function (url) { return block('EventSource', { url }); },
    HTMLFormElement: function () {},
    window: {
      sessionStorage: { setItem(key, value) { storage.push({ area: 'session', key, value: String(value) }); } },
      localStorage: { setItem(key, value) { storage.push({ area: 'local', key, value: String(value) }); } },
      crypto: { getRandomValues(array) { for (let i = 0; i < array.length; i++) array[i] = (tokenCounter++ % 250) + 1; return array; } },
      dispatchEvent(event) { events.push({ type: event.type, detail: clone(event.detail || null), atTurn: transcript.length }); },
      fetch: (...args) => block('window.fetch', { url: String(args[0]) }),
      open: (url, target) => block('window.open', { url, target }),
      location: safeLocation,
      navigator: safeNavigator,
      setTimeout: (...args) => block('window.setTimeout', { argCount: args.length })
    },
    location: safeLocation,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; }
  };
  context.HTMLFormElement.prototype = { submit() { return block('form.submit', null); } };

  // Unselected application helpers are inert by default, then known side-effect helpers are fail-closed.
  for (const name of Object.keys(funcs)) if (!(name in context)) context[name] = () => { throw new Error('UNIMPLEMENTED_HELPER:' + name); };
  Object.assign(context, {
    bookingCall,
    submitBookingAttachment: (...args) => block('submitBookingAttachment', { argCount: args.length }),
    submitContact: (...args) => block('submitContact', { argCount: args.length }),
    readAttachment: (...args) => block('readAttachment', { argCount: args.length })
  });

  for (const name of ['persist','sound','cancelClarification','interruptBotQueue','updateAttachmentAvailability','offerPreapprovalUpload']) context[name] = () => {};
  context.safetyRecord = reason => reason === 'language' ? (state.profile.safetyStrikes || 0) :
    (state.profile.safetyStrikes = (state.profile.safetyStrikes || 0) + 1);
  vm.createContext(context);
  for (const name of conversationFunctions) vm.runInContext(funcs[name], context);
  for (const name of bookingFunctions) vm.runInContext(funcs[name], context);

  function outcome() {
    const booked = serviceCalls.some(call => call.method === 'book');
    const confirmed = events.some(event => event.type === 'raleigh-booking-confirmed');
    if (poisoned) return 'isolation_failure';
    if (booked && confirmed) return 'confirmed';
    if (state.ended) return 'terminated';
    return null;
  }

  async function send(userText) {
    if (poisoned) throw new Error('Session is poisoned by an isolation failure');
    if (typeof userText !== 'string' || !userText.trim()) throw new Error('send requires a non-empty message string');
    messages.length = 0;
    context.handleText(userText, false);
    await settle();
    const botMessage = messages.join(' / ');
    transcript.push({ turn: transcript.length + 1, user: userText, bot: botMessage });
    return publicView(botMessage);
  }

  function publicView(botMessage) {
    return {
      sessionId: id,
      botMessage: botMessage === undefined ? null : botMessage,
      conversationPhase: state.booking ? 'booking' : (state.ended ? 'ended' : 'qualification'),
      bookingStep: state.booking && state.booking.step || null,
      terminal: !!state.ended || poisoned,
      outcome: outcome()
    };
  }

  function audit() {
    return {
      sessionId: id,
      metadata: clone(metadata || {}),
      transcript: clone(transcript),
      outcome: outcome(),
      internalState: clone(state),
      serviceCalls: clone(serviceCalls),
      blockedAttempts: clone(blockedAttempts),
      analytics: clone(analytics),
      events: clone(events),
      storage: clone(storage),
      isolation: {
        externalAttempts: blockedAttempts.length,
        bookingBoundaryCalls: serviceCalls.length,
        poisoned
      }
    };
  }

  return { send, publicView, audit };
}


module.exports = {createSession};
