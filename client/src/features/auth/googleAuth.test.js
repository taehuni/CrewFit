import test from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthNext, startGoogleLogin } from './googleAuth.js';

test('OAuth return path rejects external, disguised and auth routes', () => {
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/auth/google', '/login', '/feed/../../login', null, '/feed\n']) assert.equal(safeAuthNext(path), '/home');
  assert.equal(safeAuthNext('/crews/5?tab=feed#latest'), '/crews/5?tab=feed#latest');
});
test('Google login only requests sign-in, keeps app return path and propagates failure safely', async () => {
  let request;
  await startGoogleLogin({ signInWithOAuth: async input => { request = input; return { error: null }; } }, { origin: 'http://localhost:5173', next: '/crews/5' });
  assert.equal(request.provider, 'google');
  const callback = new URL(request.options.redirectTo);
  assert.equal(callback.pathname, '/auth/google');
  assert.equal(callback.searchParams.get('next'), '/crews/5');
  assert.equal(request.options.scopes, undefined);
  assert.deepEqual(request.options.queryParams, { prompt: 'select_account' });
  await assert.rejects(startGoogleLogin({ signInWithOAuth: async () => ({ error: { message: 'secret-provider-details' } }) }, { origin: 'http://localhost:5173' }), /구글 로그인을 시작하지 못했어요/);
});
