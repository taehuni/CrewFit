import test from 'node:test';
import assert from 'node:assert/strict';
import { savePost } from './posts.js';
const form = { content: '운동 완료', kind: 'log', sport: 'running', visibility: 'public' };
function fixture({ sport = 'running', route = { points: [] }, activity = true } = {}) {
  const writes = [], reads = [];
  return { writes, reads, db: { from(table) {
    reads.push(table); const q = {
      select() { return q; }, eq() { return q; },
      insert(input) { writes.push(input); return q; }, update(input) { writes.push(input); return q; },
      async maybeSingle() { return { data: table === 'activities' ? activity ? { id: 8, sport } : null : table === 'activity_routes' ? route : { id: 1 } }; },
    }; return q;
  } } };
}
test('sharing is opt-in, checks owned outdoor route and writes include_route only after validation', async () => {
  let f = fixture(); await savePost(f.db, 'me', form, null, null, undefined, '8', true);
  assert.equal(f.writes[0].include_route, true); assert.ok(f.reads.includes('activity_routes'));
  for (const options of [{ route: null }, { activity: false }, { sport: 'gym' }]) {
    f = fixture(options); await assert.rejects(savePost(f.db, 'me', form, null, null, undefined, '8', true)); assert.equal(f.writes.length, 0);
  }
  await assert.rejects(savePost({}, 'me', form, null, null, undefined, null, true));
});
test('turning off sharing never queries location data, including after detaching', async () => {
  for (const id of ['8', null]) {
    const f = fixture(); await savePost(f.db, 'me', form, null, null, undefined, id, false);
    assert.equal(f.writes[0].include_route, false); assert.ok(!f.reads.includes('activity_routes'));
  }
});
