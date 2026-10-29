import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac, randomUUID } from 'node:crypto';
const key = 'test-only-key-for-portal-assertion-validation';
const used = new Map();
const scope = {
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => key }) },
  CacheService: { getScriptCache: () => ({ get: k => used.get(k), put: (k, v) => used.set(k, v) }) },
  Utilities: {
    computeHmacSha256Signature: (payload, secret) => createHmac('sha256', secret).update(payload).digest(),
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
    base64DecodeWebSafe: text => Buffer.from(text, 'base64url'),
    newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString() })
  }
};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(new URL('../google-apps-script/chat-booking/AdminPortalService.gs', import.meta.url), 'utf8'), scope);
function assertion(overrides = {}) {
  const claim = { email: 'benjamin.raleighrealtor@gmail.com', name: 'Benjamin', action: 'session', data: {},
    expires: Math.floor(Date.now() / 1000) + 60, nonce: randomUUID(), ...overrides };
  const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return 'v1.' + payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
}
const valid = assertion();
assert.equal(scope.adminVerifyRelay_(valid, 'session', {}).email, 'benjamin.raleighrealtor@gmail.com');
assert.throws(() => scope.adminVerifyRelay_(valid, 'session', {}), /already used/);
assert.throws(() => scope.adminVerifyRelay_(assertion({ expires: 1 }), 'session', {}), /expired/);
assert.throws(() => scope.adminVerifyRelay_(assertion({ email: 'stranger@example.com' }), 'session', {}), /expired/);
assert.throws(() => scope.adminVerifyRelay_(assertion(), 'cancel', {}), /does not match/);
assert.throws(() => scope.adminVerifyRelay_(assertion(), 'session', { id: 'changed' }), /does not match/);
assert.throws(() => scope.adminVerifyRelay_(assertion().slice(0, -4) + 'xxxx', 'session', {}), /Invalid portal/);
console.log('Portal assertions reject forgery, replay, expired grants, unapproved accounts, and altered actions/data.');
