const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../assets/js/raleigh-chat-engine.js');

const source = fs.readFileSync(require.resolve('../assets/js/raleigh-chat-config.js'), 'utf8');
const scope = { window: {} };
vm.runInNewContext(source, scope);
const config = scope.window.RaleighChatConfig;

const cases = [
  ['direct buyer', 'I want to buy a home in Raleigh', 'buying'],
  ['relocating buyer', 'I am relocating from Ohio', 'relocating'],
  ['local seller', 'I need to sell my house', 'selling'],
  ['seller and buyer', 'I am selling my home and buying another', 'selling', true],
  ['investor', 'I want a rental investment', 'investing'],
  ['investor buying property', 'I am interested in buying a rental property in Raleigh', 'investing'],
  ['buyer financing question', 'What is a down payment?', null, false, 'down payment'],
  ['school question', 'What about schools?', 'relocating', false, 'schools'],
  ['tax question', 'How much are property taxes?', null, false, 'property taxes'],
  ['buyer reading', 'Where can I find buying resources?', 'buying', false, null, 'resources'],
  ['seller reading', 'I need selling resources', 'selling', false, null, 'resources'],
  ['investor reading', 'I want investing resources', 'investing', false, null, 'resources'],
  ['booking request', 'Can I book a call?', null, false, null, null, 'booking'],
  ['incidental profanity', 'My current place is shit', null, false, null, null, null, 'language'],
  ['aggressive troll', 'I will hurt your team', null, false, null, null, null, 'threat'],
  ['discriminatory request', 'I want an only white neighborhood', 'relocating', false, null, null, null, 'discrimination'],
  ['discriminatory phrasing', 'I only want a white neighborhood', 'relocating', false, null, null, null, 'discrimination'],
  ['link spammer', 'Visit https://spam.example and https://spam2.example', null, false, null, null, null, 'spam'],
  ['unrelated visitor', 'hello there', null]
];

for (const [name, text, intent, combined, faq, resource, booking, safety] of cases) {
  const found = engine.detectIntent(text, config);
  assert.equal(found && found.id, intent, `${name}: intent`);
  if (combined) assert.equal(found.combined, true, `${name}: combined sale and purchase`);
  if (faq) assert.ok(engine.findFaq(text, config)?.keywords.includes(faq), `${name}: FAQ`);
  if (resource) assert.equal(engine.wantsResources(text), true, `${name}: resource request`);
  if (booking) assert.equal(engine.wantsBooking(text), true, `${name}: booking request`);
  if (safety) assert.equal(engine.classifySafety(text), safety, `${name}: safety`);
}

assert.equal(config.flows.buying.questions.length, 22);
assert.equal(config.flows.relocating.questions.length, 27);
assert.equal(config.flows.selling.questions.length, 11);
assert.equal(engine.activeQuestions(config.flows.buying, { location: 'local', tenure: 'renting' }, false).map(q => q.key).join(','), 'location,currentArea,tenure,firstTime,leaseEnd,areas,home,budget,timing');
assert.equal(engine.activeQuestions(config.flows.buying, { location: 'out' }, false).map(q => q.key).join(','), 'location,whyRaleigh,priorities,areas,home,budget,timing');
assert.equal(engine.activeQuestions(config.flows.buying, { location: 'out', areasNeedFollowup: true, budgetKnown: true }, false).map(q => q.key).join(','), 'location,whyRaleigh,priorities,areas,areasReason,home,financing,timing');
assert.equal(engine.activeQuestions(config.flows.selling, {}, true).map(q => q.key).join(','), 'whySell,currentHome,ownedYears,nextDestination,nextAreaReason,nextHome,budget,sellingExperience,timing');
assert.equal(engine.activeQuestions(config.flows.selling, {}, false).map(q => q.key).join(','), 'currentHome,ownedYears,whySellSolo,nextDestination,sellingExperience,timing');
assert.equal(engine.activeQuestions(config.flows.selling, { shortTiming: 'soon' }, false).at(-1).key, 'timingReason');
assert.equal(engine.activeQuestions(config.flows.buying, { location: 'out', shortTiming: 'newYear' }, false).at(-1).key, 'timingReason');
assert.equal(engine.detectLocation('I live in Ohio').place, 'ohio');
assert.equal(engine.detectLocation('I am relocating from New York').place, 'new york');
assert.equal(engine.detectTenure('We rent right now'), 'renting');
assert.equal(engine.detectTenure('I own my current home'), 'owning');
assert.equal(engine.classifySafety('https://spam.example'), 'spam');
assert.equal(engine.classifySafety('asdfasdfasdf'), 'spam');
assert.equal(engine.classifySafety('nigger'), 'hate');
assert.equal(config.flows.buying.resourceLink.href, '/buy/');
assert.equal(config.flows.selling.resourceLink.href, '/sell/');
assert.equal(config.flows.investing.resourceLink.href, '/invest/resources/');
assert.equal(config.bookingLinks.investing, '/invest/');
assert.equal(config.flows.investing.booking, 'investing');
console.log(`${cases.length} chat scenarios passed`);
