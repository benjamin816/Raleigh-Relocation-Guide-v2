import assert from 'node:assert/strict';
import relay from './worker.mjs';

const env = { BOOKING_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbysLAettKRWslMW8YgG3BxftA2eBL_gsZFdK70bN7B3xu-aG_stqdNqg3jYBB5aqoMa2g/exec' };
const endpoint = 'https://relay.example.test/booking';
function request(origin, method, body) {
  return new Request(endpoint, { method, headers: { Origin: origin }, body: body == null ? undefined : JSON.stringify(body) });
}
let result = await relay.fetch(request('https://evil.example', 'POST', { method: 'adminConfig', args: [] }), env);
assert.equal(result.status, 403);
result = await relay.fetch(request('http://127.0.0.1:8777', 'POST', { method: 'arbitrary', args: [] }), env);
assert.equal(result.status, 400);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.equal(url, env.BOOKING_SCRIPT_URL);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'text/plain;charset=utf-8');
  return new Response(JSON.stringify({ ok: true, result: { clientId: 'public-id' } }), { status: 200 });
};
try {
  result = await relay.fetch(request('http://127.0.0.1:8777', 'POST', { method: 'adminConfig', args: [] }), env);
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).result, { clientId: 'public-id' });
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:8777');
} finally { globalThis.fetch = originalFetch; }
console.log('booking relay checks passed');
