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
env.ADMIN_ASSERTION_KEY = 'test-only-secret-with-at-least-32-characters';
let upstreamCalls = 0;
globalThis.fetch = async (url, init) => {
  if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) return new Response(JSON.stringify({
    aud: '1061582134341-02v0traqlpvcu35stag49oaqh9kj5pdf.apps.googleusercontent.com',
    iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 300,
    email_verified: 'true', email: 'benjamin.raleighrealtor@gmail.com'
  }));
  upstreamCalls++;
  const forwarded = JSON.parse(init.body), [version, payload, signature] = forwarded.args[0].split('.');
  assert.equal(version, 'v1');
  const claim = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.equal(claim.email, 'benjamin.raleighrealtor@gmail.com');
  assert.equal(claim.action, 'session');
  assert.deepEqual(claim.data, {});
  const { createHmac } = await import('node:crypto');
  assert.equal(signature, createHmac('sha256', env.ADMIN_ASSERTION_KEY).update(payload).digest('base64url'));
  return new Response(JSON.stringify({ ok: true, result: { viewer: { email: claim.email } } }));
};
try {
  result = await relay.fetch(request('http://127.0.0.1:8777', 'POST', { method: 'admin', args: ['x'.repeat(150), 'session', {}] }), env);
  assert.equal((await result.json()).ok, true);
  assert.equal(upstreamCalls, 1);
  result = await relay.fetch(request('http://127.0.0.1:8777', 'POST', { method: 'admin', args: ['invalid', 'session', {}] }), env);
  assert.equal((await result.json()).ok, false);
  assert.equal(upstreamCalls, 1);
} finally { globalThis.fetch = originalFetch; }
console.log('signed portal authorization checks passed');

// Device tokens are opaque here: backend verification must decide access.
globalThis.fetch = async (url, init) => {
  assert.equal(url, env.BOOKING_SCRIPT_URL, 'Device sessions must not be sent to Google tokeninfo');
  assert.equal(JSON.parse(init.body).args[0], 'ps1.'+'a'.repeat(64));
  return new Response(JSON.stringify({ok:false,error:'Your device sign-in has expired. Please sign in again.'}));
};
try {
  result=await relay.fetch(request('http://127.0.0.1:8777','POST',{method:'admin',args:['ps1.'+'a'.repeat(64),'appointments',{}]}),env);
  assert.equal((await result.json()).ok,false,'Worker must preserve backend rejection');
} finally {globalThis.fetch=originalFetch;}
console.log('Opaque device sessions remain subject to backend verification.');

let upstreamForAllowlist=0;
try {
 for (const [email,allowed] of [['ricardo.realestate23@gmail.com',true],['livinginraleighteam@gmail.com',true],['outsider@example.com',false]]) {
  const before=upstreamForAllowlist;
  globalThis.fetch=async(url,init)=>{
   if(url.startsWith('https://oauth2.googleapis.com/tokeninfo')) return new Response(JSON.stringify({aud:'1061582134341-02v0traqlpvcu35stag49oaqh9kj5pdf.apps.googleusercontent.com',iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+300,email_verified:'true',email}));
   upstreamForAllowlist++; const claim=JSON.parse(Buffer.from(JSON.parse(init.body).args[0].split('.')[1],'base64url').toString()); assert.equal(claim.email,email);
   return new Response(JSON.stringify({ok:true,result:{viewer:{email}}}));
  };
  const response=await relay.fetch(request('https://raleighncguide.com','POST',{method:'admin',args:['x'.repeat(150),'session',{}]}),env);
  assert.equal((await response.json()).ok,allowed,email);
  assert.equal(upstreamForAllowlist-before,allowed?1:0);
 }
} finally {globalThis.fetch=originalFetch;}
console.log('Google-verified account allowlist accepts both requested emails and rejects unrelated accounts before forwarding.');
