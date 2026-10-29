// Free edge relay for the existing team-owned Apps Script booking service.
// Admin requests verify Google identity and forward a short-lived signed assertion.
const ALLOWED_ORIGINS = new Set([
  'https://raleighncguide.com',
  'https://www.raleighncguide.com',
  'http://127.0.0.1:8777'
]);
const METHODS = new Set(['slots', 'check', 'suggest', 'book', 'adminConfig', 'admin']);
const ADMIN_CLIENT_ID = '1061582134341-02v0traqlpvcu35stag49oaqh9kj5pdf.apps.googleusercontent.com';
const ADMIN_EMAILS = new Set(['benjamin.raleighrealtor@gmail.com', 'benjamin.carver@exprealty.com', 'ricardo@triangleexperts.com']);
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function authorizeAdmin(body, env) {
  if (!env.ADMIN_ASSERTION_KEY) throw new Error('Portal authorization is not configured.');
  const [token, action, data = {}] = body.args;
  if (typeof token !== 'string' || !/^[A-Za-z0-9._-]{100,4096}$/.test(token)) throw new Error('Please sign in again.');
  const check = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
  if (!check.ok) throw new Error('Your sign-in has expired. Please sign in again.');
  const info = await check.json(), email = String(info.email || '').toLowerCase();
  if (info.aud !== ADMIN_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss) ||
      Number(info.exp) <= Date.now() / 1000 || String(info.email_verified) !== 'true' || !ADMIN_EMAILS.has(email))
    throw new Error('This Google account is not authorized for the portal.');
  const assertion = { email, name: String(info.name || email.split('@')[0]), action, data,
    expires: Math.floor(Date.now() / 1000) + 60, nonce: crypto.randomUUID() };
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(assertion)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.ADMIN_ASSERTION_KEY),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded))));
  body.args = ['v1.' + encoded + '.' + signature, action, data];
}

function response(body, status, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    if (url.pathname !== '/booking') return response({ ok: false, error: 'Not found.' }, 404, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return response({ ok: false, error: 'Origin not allowed.' }, 403, origin);
    if (request.method === 'OPTIONS') return response({ ok: true }, 200, origin);
    if (request.method !== 'POST') return response({ ok: false, error: 'Method not allowed.' }, 405, origin);
    const size = Number(request.headers.get('Content-Length') || 0);
    if (size > 30000) return response({ ok: false, error: 'Request is too large.' }, 413, origin);
    const raw = await request.text();
    if (raw.length > 30000) return response({ ok: false, error: 'Request is too large.' }, 413, origin);
    let body;
    try { body = JSON.parse(raw); }
    catch (_) { return response({ ok: false, error: 'Invalid JSON.' }, 400, origin); }
    if (!body || !METHODS.has(body.method) || !Array.isArray(body.args) || body.args.length > 4)
      return response({ ok: false, error: 'Invalid request.' }, 400, origin);
    const destination = String(env.BOOKING_SCRIPT_URL || '');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(destination))
      return response({ ok: false, error: 'Booking service is not configured.' }, 503, origin);
    try {
      if (body.method === 'admin') {
        try { await authorizeAdmin(body, env); }
        catch (error) { return response({ ok: false, error: error.message }, 200, origin); }
      }
      const upstream = await fetch(destination, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow'
      });
      if (!upstream.ok) throw new Error('Booking service returned an error.');
      const result = await upstream.json();
      if (!result || typeof result.ok !== 'boolean') throw new Error('Invalid booking response.');
      return response(result, 200, origin);
    } catch (_) {
      return response({ ok: false, error: 'Booking service is temporarily unavailable.' }, 502, origin);
    }
  }
};
