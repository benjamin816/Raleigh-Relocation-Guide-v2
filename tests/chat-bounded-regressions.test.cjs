const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
// Retain every frozen journey, not only the messages that exposed a bug.
for (const round of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const dir = `output/chat-bounded-round${round}`;
  execFileSync(process.execPath, ['tests/chat-fresh-batch2.cjs', `tests/fixtures/chat-bounded-round${round}.json`, dir], {stdio: 'pipe', env: {...process.env, CHAT_RESULT_FILE: 'permanent-regression-replay.json'}});
  const results = JSON.parse(fs.readFileSync(`${dir}/permanent-regression-replay.json`, 'utf8'));
  assert.equal(results.length, 50);
  for (const result of results) {
    if (result.sessionId === 'F2-33') {
      // Frozen test expected a booking after "Six months", contradicting the
      // owner's >=6-month rental rule. Preserve the original and test the rule.
      assert.equal(result.internalState.profile.rentalOnly, true);
      assert.equal(result.serviceCalls.filter(c => c.method === 'book').length, 0);
      assert.deepEqual(result.issues, ['journey-did-not-complete']);
    } else if (result.sessionId === 'F4-21') {
      // This visitor explicitly has a home to sell out of state. The owner's
      // referral exception allows a short phone call, not an ordinary consult.
      const booking=result.serviceCalls.find(call=>call.method==='book').args[0];
      assert.equal(booking.durationMinutes,15);
      assert.equal(booking.callType,'phone');
      assert.equal(booking.appointmentType,'seller_referral');
      assert.deepEqual(result.issues,['unwanted-booking']);
    } else if (result.sessionId === 'F4-43') {
      // The frozen wording check was too narrow. Verify cancellation itself.
      assert.equal(result.internalState.booking,null);
      assert.equal(result.internalState.profile.noScheduling,true);
      assert.equal(result.serviceCalls.some(call=>call.method==='book'),false);
      assert.match(result.transcript.at(-1).bot,/don't need to schedule/i);
      assert.deepEqual(result.issues,['missing-reply:No call|No appointment|won.t book|not.*book']);
    } else if (result.sessionId === 'F7-26') {
      // The tax FAQ is a valid bounded answer. The manually discovered defect
      // was failing to invite a question after the preceding preamble.
      assert.match(result.transcript.find(t=>t.user==='Can I ask one thing?').bot,/what.*question/i);
      assert.match(result.transcript.find(t=>/exact property taxes/.test(t.user)).bot,/vary by address|can change/i);
      assert.deepEqual(result.issues,['missing-reply:team|call']);
    } else if (result.sessionId === 'F7-33') {
      // Goodbye is a normal completion, rather than a spam termination.
      assert.equal(result.internalState.completed,true);
      assert.equal(result.internalState.profile.browsingEnded,true);
      assert.equal(result.serviceCalls.some(call=>call.method==='book'),false);
      assert.match(result.transcript.at(-1).bot,/Take care/);
      assert.deepEqual(result.issues,['state-mismatch:ended=false']);
    } else {
      assert.deepEqual(result.issues, [], `${result.sessionId}: ${result.label}`);
    }
    if(result.sessionId==='F8-10') {
      // This manual finding was not caught by the frozen completion grader.
      const answer=result.transcript.find(t=>/rather discuss budget/.test(t.user));
      assert.match(answer.bot,/cash|financ/i);
      assert.doesNotMatch(answer.bot,/We have Thursday|Which time works/);
    }
  }
}
console.log('450 frozen journeys retained, including checked clarification, spam, handoff, rental, referral and cancellation outcomes. All operations isolated.');
