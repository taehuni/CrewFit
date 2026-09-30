import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptPosition, createTracker, distanceBetween, routeSegments, trackingPayload, saveTrackedActivity } from './tracking.js';
import { loadOwnRoute, loadPostRoute } from './routes.js';
const epoch = Date.parse('2026-09-30T15:00:00Z');
const a = [37.5, 127, epoch], b = [37.5001, 127, epoch + 5000];
const fix = p => ({ coords: { latitude: p[0], longitude: p[1], accuracy: 5 }, timestamp: p[2] });
test('distance and sampling reject inaccurate, stale, invalid, duplicate and implausible fixes', () => {
  assert.ok(Math.abs(distanceBetween(a, b) - 11.12) < .05);
  assert.ok(acceptPosition(fix(b), a, 'running', b[2]));
  assert.equal(acceptPosition({ ...fix(b), coords: { ...fix(b).coords, accuracy: 80 } }, a, 'running', b[2]), null);
  assert.equal(acceptPosition(fix(a), a, 'running', epoch), null);
  assert.equal(acceptPosition(fix(b), a, 'running', epoch + 30000), null);
  assert.equal(acceptPosition(fix([95, 127, epoch]), null, 'running', epoch), null);
  assert.equal(acceptPosition(fix([38, 127, epoch + 1000]), a, 'running', epoch + 1000), null);
  assert.equal(acceptPosition(fix(b), a, 'gym', b[2]), null);
  assert.equal(acceptPosition(fix(b), a, 'walking', epoch), null);
});
test('long gaps split both distance and map lines', () => {
  const c = [38, 127, epoch + 60000];
  assert.equal(acceptPosition(fix(c), b, 'running', c[2]).distance, 0);
  assert.deepEqual(routeSegments([a, b, c]), [[a, b], [c]]);
  assert.deepEqual(routeSegments([[null, 0, 1]]), []);
});
test('tracker starts time at first accepted fix, clears watches, ignores late callbacks and prevents duplicate start', () => {
  let elapsed = 0, wall = epoch, callback, errback, calls = 0, cleared = [], state;
  const geo = { watchPosition(ok, fail) { callback = ok; errback = fail; calls++; return 0; }, clearWatch(id) { cleared.push(id); } };
  const tracker = createTracker({ geo, now: () => elapsed, wallNow: () => wall, onChange: s => state = s });
  tracker.start('running'); tracker.start('running'); assert.equal(calls, 1);
  elapsed = 10000; tracker.tick(); assert.equal(state.elapsed, 0);
  callback(fix(a)); elapsed += 5000; wall += 5000; callback(fix(b)); tracker.tick(); assert.equal(state.elapsed, 5000);
  tracker.stop(); assert.equal(state.status, 'done'); assert.deepEqual(cleared, [0]);
  callback(fix([37.5002, 127, epoch + 10000])); assert.equal(state.points.length, 2);
  tracker.start('walking'); errback({ code: 1 }); assert.equal(state.status, 'idle'); assert.match(state.message, /권한/);
  tracker.dispose();
});
test('late wake lock acquisition is released after leaving tracking', async () => {
  let resolve, releases = 0;
  const tracker = createTracker({ geo: { watchPosition() { return 1; }, clearWatch() {} }, wakeLock: { request: () => new Promise(r => resolve = r) }, onChange() {} });
  tracker.start('running'); await Promise.resolve(); tracker.dispose();
  resolve({ release: async () => { releases++; } }); await new Promise(r => setImmediate(r)); assert.equal(releases, 1);
});
test('save validates track, derives KST date and sends a single atomic RPC without client user id', async () => {
  const track = { points: [a, b], distance: 11.12, elapsed: 5000 };
  const payload = trackingPayload('running', track, ' 메모 ');
  assert.equal(payload.p_performed_on, '2026-10-01'); assert.equal(payload.p_distance_m, 11); assert.equal(payload.p_note, '메모');
  assert.ok(!('user_id' in payload));
  const calls = []; const db = { async rpc(...args) { calls.push(args); return { data: 12 }; } };
  assert.equal(await saveTrackedActivity(db, 'running', track), '12'); assert.equal(calls.length, 1); assert.equal(calls[0][0], 'save_tracked_activity');
  for (const bad of [{ ...track, points: [a] }, { ...track, elapsed: 0 }, { ...track, elapsed: 21600001 }, { ...track, distance: NaN }]) assert.throws(() => trackingPayload('running', bad));
  assert.throws(() => trackingPayload('gym', track));
  await assert.rejects(saveTrackedActivity({ rpc: async () => ({ error: {} }) }, 'running', track), /再|재시도/);
});
function dbFixture(post, own = true) {
  const tables = [];
  return { tables, from(table) { tables.push(table); const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: table === 'posts' ? post : table === 'activities' ? own ? { id: 1 } : null : { points: [a, b] } }; } }; return q; } };
}
test('route reads require own record or a currently visible post with explicit opt-in', async () => {
  let db = dbFixture({ activity_id: 1, include_route: false }); assert.equal(await loadPostRoute(db, 1), null); assert.deepEqual(db.tables, ['posts']);
  db = dbFixture(null); assert.equal(await loadPostRoute(db, 1), null);
  db = dbFixture({ activity_id: 1, include_route: true }); assert.deepEqual((await loadPostRoute(db, 1)).points, [a, b]);
  db = dbFixture(null, false); assert.equal(await loadOwnRoute(db, 'me', 1), null); assert.deepEqual(db.tables, ['activities']);
  assert.equal(await loadOwnRoute({}, 'me', 'bad'), null);
});
