// Free edge relay for the existing team-owned Apps Script booking service.
// It never holds Google credentials or grants admin access by itself.
const ALLOWED_ORIGINS = new Set([
  'https://raleighncguide.com',
  'https://www.raleighncguide.com',
  'http://127.0.0.1:8777'
]);
const METHODS = new Set(['slots', 'check', 'suggest', 'book', 'adminConfig', 'admin']);

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
