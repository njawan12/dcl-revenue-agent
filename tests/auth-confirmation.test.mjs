import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmEmail, preserveSessionResponse, safeNext } from '../lib/auth/confirmation.js';

test('token-hash email confirmation verifies the token', async () => {
  let received;
  const auth = { verifyOtp: async (args) => { received = args; return { error: null }; } };
  assert.equal(await confirmEmail(auth, new URLSearchParams('token_hash=receipt&type=email')), true);
  assert.deepEqual(received, {type: 'email', token_hash: 'receipt'});
});

test('default PKCE callback exchanges the code for a cookie session', async () => {
  let received;
  const auth = { exchangeCodeForSession: async (code) => { received = code; return { error: null }; } };
  assert.equal(await confirmEmail(auth, new URLSearchParams('code=one-use-code')), true);
  assert.equal(received, 'one-use-code');
});

test('expired, provider-error and unsupported links never establish a session', async () => {
  const auth = { exchangeCodeForSession: async () => ({error: new Error('expired')}) };
  assert.equal(await confirmEmail(auth, new URLSearchParams('code=expired')), false);
  for (const query of ['', 'error=access_denied&code=x', 'token_hash=x&type=recovery', 'token_hash=x&type=invalid']) {
    assert.equal(await confirmEmail({}, new URLSearchParams(query)), false);
  }
});

test('redirect retains refreshed cookies, deletions and cache protection', () => {
  const cookies = [{name: 'session',value: 'refreshed',httpOnly: true}, {name: 'old-chunk',value: '',maxAge:0}];
  const received = [];
  const source = {cookies:{getAll:()=>cookies},headers:new Headers({'cache-control':'private, no-store','pragma':'no-cache'})};
  const target = {cookies:{set:(cookie)=>received.push(cookie)},headers:new Headers()};
  assert.equal(preserveSessionResponse(source,target),target);
  assert.deepEqual(received,cookies);
  assert.equal(target.headers.get('cache-control'),'private, no-store');
  assert.equal(target.headers.get('pragma'),'no-cache');
});

test('login return path blocks external and browser-normalized redirects', () => {
  for (const value of ['https://example.invalid', '//example.invalid', '/\\example.invalid', '/\nexample.invalid', null]) assert.equal(safeNext(value), '/');
  assert.equal(safeNext('/accounts?view=priority'), '/accounts?view=priority');
});

test('confirmation transport failures return to login safely', async () => {
  assert.equal(await confirmEmail({exchangeCodeForSession: async () => { throw new Error('network'); }}, new URLSearchParams('code=x')), false);
});
