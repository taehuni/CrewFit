import test from 'node:test';
import assert from 'node:assert/strict';
import { readAuthLink, confirmationRedirect, signupWithEmail, resendConfirmation } from './authLinks.js';

test('URL classification detects old root links, errors and recovery without retaining credentials', () => {
  assert.deepEqual(readAuthLink('http://localhost:5173/#access_token=secret&type=signup'), { present: true, recovery: false, error: false });
  assert.deepEqual(readAuthLink('http://localhost:5173/#error=access_denied&error_code=otp_expired'), { present: true, recovery: false, error: true });
  assert.deepEqual(readAuthLink('http://localhost:5173/#access_token=secret&type=recovery'), { present: true, recovery: true, error: false });
  assert.deepEqual(readAuthLink('http://localhost:5173/reset-password#error_code=otp_expired'), { present: true, recovery: true, error: true });
  assert.equal(readAuthLink('http://localhost:5173/?code=secret').present, true);
  assert.equal(readAuthLink('http://localhost:5173/#features').present, false);
  assert.equal(confirmationRedirect('https://crewfit.example'), 'https://crewfit.example/auth/callback');
});

test('signup with confirmation enabled is a check-email state, not a missing-session error', async () => {
  let request;
  const auth = { signUp: async input => { request = input; return { data: { user: {}, session: null }, error: null }; } };
  assert.equal(await signupWithEmail(auth, { email: ' test@example.com ', password: 'secret', nickname: '별명', real_name: '이름' }, 'https://crewfit.example'), 'check-email');
  assert.equal(request.options.emailRedirectTo, 'https://crewfit.example/auth/callback');
  assert.deepEqual(request.options.data, { nickname: '별명', real_name: '이름' });
  assert.equal(request.email, 'test@example.com');
  auth.signUp = async () => ({ data: { session: {} } });
  assert.equal(await signupWithEmail(auth, { email: 'test@example.com' }, 'https://crewfit.example'), 'signed-in');
  auth.signUp = async () => ({ error: new Error('offline') });
  await assert.rejects(signupWithEmail(auth, { email: 'test@example.com' }, 'https://crewfit.example'), /offline/);
});

test('resend uses signup confirmation and same redirect; rate limits and transport failures propagate', async () => {
  let request;
  const auth = { resend: async input => { request = input; return { error: null }; } };
  await resendConfirmation(auth, ' test@example.com ', 'https://crewfit.example');
  assert.deepEqual(request, { type: 'signup', email: 'test@example.com', options: { emailRedirectTo: 'https://crewfit.example/auth/callback' } });
  auth.resend = async () => ({ error: Object.assign(new Error('limited'), { status: 429 }) });
  await assert.rejects(resendConfirmation(auth, 'test@example.com', 'https://crewfit.example'), error => error.status === 429);
  auth.resend = async () => { throw new Error('offline'); };
  await assert.rejects(resendConfirmation(auth, 'test@example.com', 'https://crewfit.example'), /offline/);
});
