const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname + '/../assets/js/raleigh-chat.js', 'utf8');
const start = source.indexOf('  function bookingLabel(');
const end = source.indexOf('  function bookingFailed(', start);
assert(start >= 0 && end > start, 'booking preference functions are present');
const code = source.slice(start, end) + '\n({ bookingPreferenceFromText, hasBookingPreference, offeredBookingChoice, normalizeSuggestedTime, bookingDayKey })';
const { bookingPreferenceFromText: parse, hasBookingPreference: has, offeredBookingChoice: choose, normalizeSuggestedTime: normalize, bookingDayKey: dayKey } = vm.runInNewContext(code);

const specific = parse('Could we meet with Ricardo on a Saturday evening?');
assert.equal(specific.host, 'Ricardo');
assert.equal(specific.daypart, 'evening');
assert.deepEqual(Array.from(specific.weekdays), [6]);
const weekend = parse('We need a weekend morning with Ben');
assert.equal(weekend.host, 'Benjamin');
assert.equal(weekend.daypart, 'morning');
assert.deepEqual(Array.from(weekend.weekdays), [0, 6]);
const revised = parse('Actually, Friday afternoon', weekend);
assert.equal(revised.host, 'Benjamin');
assert.equal(revised.daypart, 'afternoon');
assert.deepEqual(Array.from(revised.weekdays), [5]);
const open = parse('No preference', revised);
assert.equal(open.host, '');
assert.equal(open.daypart, '');
assert.deepEqual(Array.from(open.weekdays), []);
assert.equal(has('Do you have anything on Tuesday?'), true);
assert.equal(has('The first one works'), false);
const thursday = { start: '2026-10-29T17:00:00.000Z', daypart: 'afternoon' };
const friday = { start: '2026-10-30T22:00:00.000Z', daypart: 'evening' };
assert.equal(choose('Friday works', [thursday, friday]).start, friday.start);
assert.equal(choose('Thursday at 1pm', [thursday, friday]).start, thursday.start);
assert.equal(choose('the second one', [thursday, friday]).start, friday.start);
assert.equal(choose('anything for Saturday?', [thursday, friday]), null);
assert.equal(choose('Friday at noon', [thursday, friday]), null);
assert.equal(dayKey(thursday.start), '2026-10-29');
assert.match(normalize('Saturday at noon'), /^\d{4}-\d{2}-\d{2} 12pm ET$/);
assert.match(normalize('today at 3pm'), /^\d{4}-\d{2}-\d{2} 3pm ET$/);
assert.equal(parse('Saturday at noon', parse('evening')).daypart, '');
assert.match(parse('next Saturday').date, /^\d{4}-\d{2}-\d{2}$/);
const pairSource = source.slice(source.indexOf('  function showBookingPair('), source.indexOf('  function startBooking('));
function offeredPair(preference, slots) {
  const context = { state: { booking: { allSlots: slots, offset: 0, preference, slots: [] } },
    config: { bookingChoicePrompt: 'Which time works?' }, message() {},
    bookingDayKey: dayKey, bookingLabel: start => start };
  vm.runInNewContext(pairSource + '\nshowBookingPair();', context);
  return context.state.booking.slots;
}
const saturdaySlots = [
  { start: '2026-11-07T15:00:00.000Z', daypart: 'morning' },
  { start: '2026-10-31T16:00:00.000Z', daypart: 'midday' },
  { start: '2026-10-31T14:00:00.000Z', daypart: 'morning' },
  { start: '2026-11-07T17:00:00.000Z', daypart: 'midday' }
];
const saturdayPair = offeredPair({ weekdays: [6], date: '' }, saturdaySlots);
assert.deepEqual(Array.from(saturdayPair, slot => dayKey(slot.start)), ['2026-10-31', '2026-10-31']);
assert.equal(saturdayPair[0].daypart, 'morning');
assert.equal(saturdayPair[1].daypart, 'midday');
assert.equal(offeredPair({ weekdays: [6], date: '' }, saturdaySlots.slice(0, 2)).length, 1,
  'one opening this Saturday must not be paired with next Saturday');
const defaultPair = offeredPair({ weekdays: [], date: '' }, [thursday, friday]);
assert.notEqual(dayKey(defaultPair[0].start), dayKey(defaultPair[1].start));
for (const phrase of ['Friday works', 'Friday is good', 'yes, Friday', 'let us do Friday', 'Friday at 6pm', 'the second one']) {
  assert.equal(choose(phrase, [thursday, friday])?.start, friday.start, phrase);
}
for (const phrase of ['anything for Saturday', 'Saturday morning', 'do you have Friday at noon']) {
  assert.equal(choose(phrase, [thursday, friday]), null, phrase);
}
const today = dayKey(new Date());
const nextDay = new Date(today + 'T12:00:00Z');
nextDay.setUTCDate(nextDay.getUTCDate() + 1);
const todaySlot = { start: today + 'T16:00:00.000Z' };
const tomorrowSlot = { start: nextDay.toISOString().slice(0, 10) + 'T16:00:00.000Z' };
assert.equal(choose('today works', [todaySlot, tomorrowSlot]).start, todaySlot.start);
assert.equal(choose('tomorrow is good', [todaySlot, tomorrowSlot]).start, tomorrowSlot.start);
assert.equal(choose('tomorrow', [todaySlot, tomorrowSlot]).start, tomorrowSlot.start);
assert.equal(choose('tomorrow at that time', [todaySlot, tomorrowSlot]).start, tomorrowSlot.start);
for (const phrase of ['Friday works', 'Friday is good', 'yes, Friday', 'let us do Friday', 'Friday at 6pm', 'the second one']) {
  for (let i = 0; i < 20; i++) {
    assert.equal(choose(phrase, [thursday, friday])?.start, friday.start, phrase + ' repeat ' + i);
  }
}
const answerSource = source.slice(source.indexOf('  function handleBookingAnswer('), source.indexOf('  function link(', source.indexOf('  function handleBookingAnswer(')));
function runBookingAnswer(value, slots = [thursday, friday]) {
  const calls = [];
  const messages = [];
  const booking = { step: 'choose', slots, allSlots: slots, preference: { host: '', daypart: '', weekdays: [], date: '' }, details: {} };
  const context = { state: { booking }, config: { chatRoundRobinBookingEnabled: true, chatVideoBookingEnabled: true,
    bookingEmailPrompt: 'What is your email?' }, bookingPreferenceFromText: parse,
    hasBookingPreference: has, offeredBookingChoice: choose, requestedClock: vm.runInNewContext(code + '\nrequestedClock'),
    normalizeSuggestedTime: normalize, bookingDayKey: dayKey, bookingLabel: start => start,
    message: text => messages.push(text), loadBookingSlots: () => calls.push('slots'),
    bookingCall: (method, args) => { calls.push([method, args]); return Promise.resolve({ available: false }); } };
  vm.runInNewContext(answerSource + '\nhandleBookingAnswer(input)', Object.assign(context, { input: value }));
  return { booking, calls, messages };
}
assert.equal(runBookingAnswer('Friday works').booking.start, friday.start);
assert.equal(runBookingAnswer('the second one').booking.start, friday.start);
assert.equal(runBookingAnswer('Friday').booking.start, friday.start);
assert.equal(runBookingAnswer('anything for Saturday').calls[0], 'slots');
assert.equal(runBookingAnswer('anything for Saturday').booking.preference.weekdays[0], 6);
const exactRequest = runBookingAnswer('Saturday at noon');
assert.equal(exactRequest.calls[0][0], 'suggest');
assert.match(exactRequest.calls[0][1][0], /^\d{4}-\d{2}-\d{2} 12pm ET$/);
const todayRequest = runBookingAnswer('Can we do today at 3?');
assert.equal(todayRequest.calls[0][0], 'suggest');
assert.match(todayRequest.calls[0][1][0], /^\d{4}-\d{2}-\d{2} 3pm ET$/);
const twoSaturdaySlots = saturdaySlots.filter(slot => dayKey(slot.start) === '2026-10-31');
const saturdayAnswer = runBookingAnswer('Saturday', twoSaturdaySlots);
assert.match(saturdayAnswer.messages[0], /earlier or later/i);
assert.equal(saturdayAnswer.calls.length, 0);
console.log('Chat booking preference parsing passed');
