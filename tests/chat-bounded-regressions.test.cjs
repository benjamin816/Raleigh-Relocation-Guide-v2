const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
// Retain every frozen journey, not only the messages that exposed a bug.
for (const round of [1, 2, 3]) {
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
    } else {
      assert.deepEqual(result.issues, [], `${result.sessionId}: ${result.label}`);
    }
  }
}
console.log('150 frozen journeys retained: 149 expected completions plus one verified long-renter exit. All operations isolated.');
