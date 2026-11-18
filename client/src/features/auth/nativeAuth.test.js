import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeAuth, NATIVE_AUTH_REDIRECT, NATIVE_EMAIL_REDIRECT, NATIVE_RECOVERY_REDIRECT } from './nativeAuth.js';

function setup() {
  const values = new Map(), calls = [], paths = [];
  let time = 1000;
  const auth = {
    signInWithOAuth: async input => { calls.push(input); return { data: { url: 'https://auth.example/authorize' } }; },
    exchangeCodeForSession: async code => { calls.push(code); return { data: { session: { user: {} } } }; },
  };
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const deps = { auth, storage, now: () => time, open: async () => {}, close: async () => {}, navigate: path => paths.push(path) };
  return { auth, calls, paths, deps, bridge: createNativeAuth(deps), advance: () => { time += 16 * 60 * 1000; } };
}
test('native login uses external browser and code flow; cold restart preserves destination', async () => {
  const s = setup(); await s.bridge.start('/pose');
  assert.equal(s.calls[0].options.redirectTo, NATIVE_AUTH_REDIRECT);
  assert.equal(s.calls[0].options.skipBrowserRedirect, true);
  await createNativeAuth(s.deps).receive(`${NATIVE_AUTH_REDIRECT}?code=sample`);
  assert.deepEqual(s.paths, ['/pose']);
  await s.bridge.receive(`${NATIVE_AUTH_REDIRECT}?code=sample`);
  assert.equal(s.calls.length, 2);
});

test('email confirmation and recovery return to the correct app screen after restart', async () => {
  for (const [kind, redirect, destination] of [['email', NATIVE_EMAIL_REDIRECT, '/home'], ['recovery', NATIVE_RECOVERY_REDIRECT, '/reset-password']]) {
    const s = setup();
    await s.bridge.requestEmail(kind, async url => { assert.equal(url, redirect); });
    await createNativeAuth(s.deps).receive(`${redirect}?code=email-code`);
    assert.deepEqual(s.calls, ['email-code']);
    assert.deepEqual(s.paths, [destination]);
  }
});

test('recovery refuses uninitiated or mismatched links and failed requests clear pending state', async () => {
  const s = setup();
  await s.bridge.receive(`${NATIVE_RECOVERY_REDIRECT}?code=unrequested`);
  assert.equal(s.calls.length, 0);assert.deepEqual(s.paths, ['/forgot?nativeAuth=failed']);
  await s.bridge.start('/home');
  await s.bridge.receive(`${NATIVE_RECOVERY_REDIRECT}?code=wrong-kind`);
  assert.equal(s.calls.length, 1);
  await assert.rejects(s.bridge.requestEmail('recovery', async () => { throw new Error('offline'); }), /offline/);
  await s.bridge.receive(`${NATIVE_RECOVERY_REDIRECT}?code=failed-request`);
  assert.equal(s.calls.length, 1);
});

test('email requests allow mailbox delay but expire after one hour', async () => {
  const s = setup();await s.bridge.requestEmail('email', async () => {});s.advance();
  await s.bridge.receive(`${NATIVE_EMAIL_REDIRECT}?code=valid`);
  assert.deepEqual(s.paths, ['/home']);
  await s.bridge.requestEmail('recovery', async () => {});
  for(let i=0;i<4;i++)s.advance();
  await s.bridge.receive(`${NATIVE_RECOVERY_REDIRECT}?code=expired`);
  assert.deepEqual(s.calls, ['valid']);assert.equal(s.paths.at(-1), '/forgot?nativeAuth=failed');
});

test('native callback passes a valid SDK flow id and rejects duplicates or credential fragments', async () => {
  const s = setup();let exchanged;
  s.auth.exchangeCodeForSession = async (code, options) => { exchanged = {code, options}; return {data:{session:{}}}; };
  await s.bridge.requestEmail('recovery', async () => {});
  await s.bridge.receive(`${NATIVE_RECOVERY_REDIRECT}?code=code&sb_flow_id=sample_flow_id`);
  assert.deepEqual(exchanged,{code:'code',options:{flowId:'sample_flow_id'}});
  for(const suffix of ['?code=a&sb_flow_id=one&sb_flow_id=two','?code=a#access_token=secret','?code=a&sb_flow_id=short']) {
    const bad=setup();await bad.bridge.requestEmail('recovery',async()=>{});
    await bad.bridge.receive(NATIVE_RECOVERY_REDIRECT+suffix);
    assert.equal(bad.calls.length,0);assert.equal(bad.paths.at(-1),'/forgot?nativeAuth=failed');
  }
});
test('invalid, expired, denied callbacks never exchange; errors are generic', async () => {
  for (const suffix of ['?code=a&code=b', '?code=a#token', '?error=denied', '?code=']) {
    const s = setup(); await s.bridge.start('/home'); await s.bridge.receive(NATIVE_AUTH_REDIRECT + suffix);
    assert.equal(s.calls.length, 1); assert.deepEqual(s.paths, ['/login?nativeAuth=failed']);
  }
  const s = setup(); await s.bridge.start('/home'); s.advance(); await s.bridge.receive(`${NATIVE_AUTH_REDIRECT}?code=a`);
  assert.equal(s.calls.length, 1);
});
test('unrelated links ignored; exchange errors cannot leak provider details', async () => {
  const s = setup(); await s.bridge.start('//external.test');
  assert.equal(await s.bridge.receive('https://auth/google?code=x'), false);
  s.auth.exchangeCodeForSession = async () => ({ error: { message: 'secret' } });
  await s.bridge.receive(`${NATIVE_AUTH_REDIRECT}?code=a`);
  assert.deepEqual(s.paths, ['/login?nativeAuth=failed']);
});
test('simultaneous callbacks exchange only once', async () => {
  const s = setup(); await s.bridge.start('/coach');
  await Promise.all([s.bridge.receive(`${NATIVE_AUTH_REDIRECT}?code=a`), s.bridge.receive(`${NATIVE_AUTH_REDIRECT}?code=a`)]);
  assert.equal(s.calls.length, 2); assert.deepEqual(s.paths, ['/coach']);
});
test('browser failure clears pending login and permits retry', async () => {
  const s = setup(); s.deps.open = async () => { throw new Error('private'); };
  await assert.rejects(createNativeAuth(s.deps).start('/home'), /다시 시도/);
  await s.bridge.receive(`${NATIVE_AUTH_REDIRECT}?code=a`); assert.equal(s.paths.length, 0);
  await s.bridge.start('/home'); await s.bridge.receive(`${NATIVE_AUTH_REDIRECT}?code=b`);
  assert.deepEqual(s.paths, ['/home']);
});
