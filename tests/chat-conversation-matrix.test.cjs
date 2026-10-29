const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../assets/js/raleigh-chat-engine.js');
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/raleigh-chat-config.js'), 'utf8'), scope);
const config = scope.window.RaleighChatConfig;
let checks = 0;
function check(actual, expected, phrase) { assert.equal(actual, expected, phrase); checks++; }
const october = new Date(2026, 9, 28);
for (const phrase of ['now', 'ASAP', 'in 3 months', 'within 90 days', 'December', 'December 2026']) check(engine.classifyMoveTiming(phrase, october), 'soon', phrase + ' is within three months');
for (const phrase of ['January', 'in the new year', 'New Year']) check(engine.classifyMoveTiming(phrase, october), 'newYear', phrase + ' is a near-term new-year move');
for (const phrase of ['next summer', 'in six months', 'February 2027', 'December 2027', 'not now']) check(engine.classifyMoveTiming(phrase, october), '', phrase + ' is not an immediate move');

const intents = {
  buying: [
    'I want to buy in Raleigh', 'We are buying a house', 'I am a first-time buyer',
    'Looking to purchase a home', 'Can you help with my home search?', 'I need a mortgage for a home',
    'I want to buy my first place', 'Buying a townhouse in Cary', 'I am pre-approved and ready to buy',
    'We plan to purchase a single family home', 'I am looking for a home in North Raleigh',
    'Our family wants to buy near downtown', 'I am buying after my lease ends'
  ],
  selling: [
    'I need to sell my house', 'We are selling in Cary', 'I am a seller in Raleigh',
    'I want to list my home', 'What is my home worth?', 'I need a home value',
    'Thinking of selling my condo', 'Help me sell in Durham', 'We need to list our house',
    'I am selling and buying another house', 'I want to sell and then buy',
    'We are buying and selling in Raleigh', 'I need to sell before relocating'
  ],
  relocating: [
    'I am relocating from New York', 'We are moving to Raleigh', 'I am new to Raleigh',
    'Can you help me choose a suburb?', 'We are relocating next year', 'I need a shorter commute',
    'Which neighborhood should I consider?', 'Moving from Ohio to the Triangle',
    'I need help with schools in Raleigh', 'Our family is moving to Cary'
  ],
  investing: [
    'I want a rental investment', 'I am buying a rental property', 'Looking to invest in Raleigh',
    'Does an Airbnb work here?', 'I want cash flow', 'I need a DSCR loan for a rental',
    'I am an investor from Ohio', 'Which cap rate is realistic?',
    'I want a short term rental', 'I am looking for a multifamily property',
    'Buying an investment property in Cary', 'I want to house hack a rental'
  ]
};
for (const [expected, phrases] of Object.entries(intents)) {
  for (const phrase of phrases) check(engine.detectIntent(phrase, config)?.id, expected, phrase);
}
for (const phrase of ['I live in Ohio', 'I am moving from Ohio', 'Relocating from New York', 'We live in Florida', 'I am out of state']) check(engine.detectLocation(phrase)?.type, 'out', phrase);
for (const phrase of ['Idaho', 'Idaho.', 'ID', 'ID!', 'Delaware', 'DE', 'Boise']) {
  const location = engine.detectLocation(phrase, config);
  check(location?.type, 'out', phrase + ' is an out-of-state answer');
  check(engine.resolveOrigin(location, config)?.place, /^(idaho|id|boise)/i.test(phrase) ? 'idaho' : 'delaware', phrase + ' resolves to a state');
}
for (const [origin, expected] of [['CA', 'california'], ['TX', 'texas'], ['Dallas', 'texas'], ['San Diego', 'california'], ['Delaware', 'delaware']]) check(engine.resolveOrigin({ type: 'out', place: origin }, config).place, expected, origin);
for (const [code, name] of Object.entries(config.originStates)) check(engine.resolveOrigin({ type: 'out', place: code }, config).place, name.toLowerCase(), code);
check(engine.resolveOrigin({ type: 'out', place: 'Portland' }, config).stateCode, '', 'Ambiguous city does not guess a state');
check(engine.resolveOrigin({ type: 'out', place: 'Greenville' }, config).stateCode, '', 'Known shared city name does not guess a state');
check(engine.resolveOrigin({ type: 'out', place: 'Portland, OR' }, config).place, 'oregon', 'Explicit state disambiguates city');
for (const phrase of ["I'm moving to Raleigh", "I'm relocating"]) check(engine.detectLocation(phrase), null, phrase);
for (const phrase of ['I already live here', 'I am local', 'I live in Raleigh', 'I live in Cary', 'I live in Durham', 'I am in Raleigh', "I'm in Raleigh", 'I live in North Raleigh']) check(engine.detectLocation(phrase)?.type, 'local', phrase);
for (const phrase of ['I rent', 'We are renting', 'Our lease ends soon', 'I am a tenant']) check(engine.detectTenure(phrase), 'renting', phrase);
for (const phrase of ['I own', 'We own our home', 'I am a homeowner', 'My house is paid off']) check(engine.detectTenure(phrase), 'owning', phrase);
for (const phrase of ['Where can I learn more?', 'Can I read a guide?', 'Do you have resources?', 'Are there articles?', 'Where is the website?']) check(engine.wantsResources(phrase), true, phrase);
check(engine.wantsResources('What do I need to know about selling?'), false, 'Information question does not automatically push a resource page');
for (const phrase of ['Can we book a call?', 'I want to schedule', 'Can I talk to the team?', 'I need an appointment', 'Can we meet with Benjamin?', 'Could you call me?']) check(engine.wantsBooking(phrase), true, phrase);
for (const phrase of ['Visit https://spam.example', 'www.spam.example', 'https://a.example https://b.example']) check(engine.classifySafety(phrase), 'spam', phrase);
for (const phrase of ['asdfasdfasdf', 'zzzzzzzzzzzzzz', 'hshsj']) check(engine.classifySafety(phrase), 'gibberish', phrase);
check(engine.classifySafety('https://zillow.com/homedetails/example'), null, 'property listing link');
check(engine.classifySafety('https://zillow.com.spam.example'), 'spam', 'fake listing domain');
for (const phrase of ['I will hurt your team', 'I will kill you', 'I will attack your agents']) check(engine.classifySafety(phrase), 'threat', phrase);
for (const phrase of ['I only want a white neighborhood', 'Tell me the racial makeup', 'Avoid black neighbors']) check(engine.classifySafety(phrase), 'discrimination', phrase);
for (const phrase of ['My current place is shit', 'Damn, this is expensive']) check(engine.classifySafety(phrase), 'language', phrase);
const branches = [
  ['buying', { location: 'out' }, false, 'location,whyRaleigh,priorities,areas,home,budget,timing'],
  ['buying', { location: 'local', tenure: 'renting' }, false, 'location,currentArea,tenure,firstTime,leaseEnd,areas,home,budget,timing'],
  ['buying', { location: 'local', tenure: 'owning' }, false, 'location,currentArea,tenure,willSell,areas,home,budget,timing'],
  ['relocating', { location: 'out' }, false, 'location,whyRaleigh,originHousing,priorities,areas,home,budget,timing'],
  ['relocating', { location: 'local', tenure: 'renting' }, false, 'location,moveGoal,currentArea,tenure,firstTime,leaseEnd,areas,home,budget,timing'],
  ['relocating', { location: 'local', tenure: 'owning' }, false, 'location,moveGoal,currentArea,tenure,willSell,areas,home,budget,timing'],
  ['buying', { location: 'out', areasNeedFollowup: true, budgetKnown: true }, false, 'location,whyRaleigh,priorities,areas,areasReason,home,financing,timing'],
  ['relocating', { location: 'out', areasNeedFollowup: true, budgetKnown: true }, false, 'location,whyRaleigh,originHousing,priorities,areas,areasReason,home,financing,timing'],
  ['relocating', { location: 'out', rentalClarificationNeeded: true }, false, 'location,whyRaleigh,originHousing,priorities,areas,rentalPlan,home,budget,timing'],
  ['relocating', { location: 'out', newJob: true }, false, 'location,whyRaleigh,jobLocation,jobStart,originHousing,priorities,areas,home,budget,timing'],
  ['relocating', { location: 'out', familyNearby: true }, false, 'location,whyRaleigh,familyNearby,originHousing,priorities,areas,home,budget,timing'],
  ['selling', {}, false, 'currentHome,ownedYears,whySellSolo,nextDestination,sellingExperience,timing'],
  ['selling', {}, true, 'whySell,currentHome,ownedYears,nextDestination,nextAreaReason,nextHome,budget,sellingExperience,timing'],
  ['investing', { location: 'local' }, false, 'location,experience,strategy,timing,areas,goals,involvement,budget'],
  ['investing', { location: 'out' }, false, 'location,experience,strategy,timing,areas,goals,involvement,budget']
];
for (const [id, profile, combined, expected] of branches) check(engine.activeQuestions(config.flows[id], profile, combined).map(q => q.key).join(','), expected, `${id} ${JSON.stringify(profile)} ${combined}`);
for (const id of ['buying', 'relocating']) {
  const flow = config.flows[id];
  const keys = profile => engine.activeQuestions(flow, { location: 'out', ...profile }, false).map(q => q.key);
  check(keys({ prioritySingle: true }).includes('priorityMore'), true, `${id} single detail asks for more`);
  check(keys({ priorityPrice: true }).includes('priorityBudget'), true, `${id} price mentioned asks budget early`);
  check(keys({ priorityPrice: true, budgetAsked: true }).includes('priorityFinancing'), true, `${id} early budget asks financing`);
  check(keys({ homeSingle: true }).includes('homeMore'), true, `${id} one home detail asks for more`);
  check(keys({ homeSingle: false }).includes('homeMore'), false, `${id} multiple home details move on`);
  check(keys({ commuteMentioned: true }).includes('commuteDestination'), true, `${id} commute asks destination`);
  check(keys({ commuteMentioned: true, commuteDestinationKnown: true }).includes('commuteRange'), true, `${id} commute asks comfort range`);
  check(keys({ commuteMentioned: true, remoteWork: true }).includes('commuteDestination'), false, `${id} remote work skips commute`);
  check(keys({ commuteMentioned: true, retired: true }).includes('commuteRange'), false, `${id} retirement skips commute`);
  const completed = keys({ priorityPrice: true, budgetAsked: true, budgetKnown: true, financingKnown: true });
  for (const key of ['priorityBudget', 'priorityFinancing', 'budget', 'financing']) check(completed.includes(key), false, `${id} no repeated ${key}`);
}
assert.ok(checks >= 100, `Expected at least 100 checks, got ${checks}`);
console.log(`${checks} conversation routing, interruption, safety, and branch checks passed`);
