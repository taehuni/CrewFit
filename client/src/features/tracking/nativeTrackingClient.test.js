import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeTrackingClient, normalizeNativeSnapshot } from './nativeTrackingClient.js';
const owner = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
const snapshot = () => ({ status: 'done', sessionId: id, sport: 'walking', points: [[37, 127, 100000], [37.0001, 127, 110000]], elapsed: 10000, distance: 11, notificationsEnabled: true });

test('restored native result keeps stable save identifier and ignores extra native fields', () => {
  const value = normalizeNativeSnapshot({ ...snapshot(), ownerId: owner, private: 'not exposed' });
  assert.equal(value.sessionId, id); assert.equal(value.elapsed, 10000); assert.equal(value.points.length, 2);
  assert.equal(value.ownerId, undefined); assert.equal(value.private, undefined);
  assert.equal(value.notificationsEnabled, true);
});
test('summary polls need no coordinates, and idle cannot leak an old route', () => {
  assert.deepEqual(normalizeNativeSnapshot({ ...snapshot(), points: undefined }, true).points, []);
  assert.deepEqual(normalizeNativeSnapshot({ ...snapshot(), status: 'idle' }).points, []);
});
test('malformed native results never reach save UI', () => {
  for (const changed of [{ sessionId: 'x' }, { sport: 'swimming' }, { elapsed: 21600001 }, { distance: -1 }, { points: [[91, 1, 100]] }, { points: [[37, 127, 100], [37, 127, 100]] }, { status: 'unknown' }]) {
    assert.throws(() => normalizeNativeSnapshot({ ...snapshot(), ...changed }));
  }
});
test('native operations bind to owner and clear to exact session; invalid inputs never call plugin', async () => {
  const calls = [], changed = [];
  const plugin = Object.fromEntries(['snapshot', 'start', 'stop', 'clear'].map(name => [name, async args => { calls.push({ name, args }); return snapshot(); }]));
  const client = createNativeTrackingClient(plugin, () => changed.push(true));
  await client.snapshot(owner, true); await client.start(owner, id, 'walking'); await client.stop(owner); await client.clear(owner, id);
  assert.deepEqual(calls.map(x => x.args.ownerId), [owner, owner, owner, owner]);
  assert.equal(calls[3].args.sessionId, id); assert.equal(calls[0].args.summaryOnly, true); assert.equal(changed.length, 3);
  assert.throws(() => client.start(owner, id, 'gym')); assert.throws(() => client.clear(owner, 'bad')); assert.throws(() => client.snapshot('bad'));
  assert.equal(calls.length, 4);
});
test('permission and ownership failures remain understandable without leaking native detail', async () => {
  for (const code of ['OWNER_MISMATCH', 'PERMISSION_DENIED', 'LOCATION_DISABLED', 'SESSION_EXISTS', 'PRIVATE_NATIVE_ERROR']) {
    const client = createNativeTrackingClient({ snapshot: async () => { throw { code, message: 'secret owner and coordinates' }; } });
    await assert.rejects(client.snapshot(owner), error => !error.message.includes('secret') && error.message.length > 10);
  }
});
test('sign-out suspend neither reads nor returns another account route', async () => {
  let count = 0;
  const client = createNativeTrackingClient({ suspend: async () => { count++; return snapshot(); } });
  assert.equal(await client.suspend(), undefined); assert.equal(count, 1);
});
