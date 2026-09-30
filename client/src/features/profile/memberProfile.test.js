import test from 'node:test';
import assert from 'node:assert/strict';
import { profileInput, savePublicProfile, loadMember, loadMemberRecords, loadMemberCrews } from './memberProfile.js';
import { queryKeys } from '../../shared/queryKeys.js';
const id = '00000000-0000-4000-8000-000000000027';
const form = { nickname: ' 러너 ', activity_visibility: 'crew', show_crews: false };
function mock(data, error = null) {
  const calls = [];
  const db = { from(table) {
    calls.push(['from', table]);
    const q = { then(resolve) { return Promise.resolve({ data, error }).then(resolve); } };
    for (const name of ['select', 'update', 'eq', 'gt', 'order', 'limit', 'or', 'abortSignal', 'single', 'maybeSingle']) q[name] = (...args) => { calls.push([name, ...args]); return q; };
    return q;
  } };
  return { db, calls };
}
test('profile write normalizes nickname, whitelists fields and validates all visibility states', () => {
  assert.deepEqual(profileInput({ ...form, real_name: 'secret', id: 'other' }), { ...form, nickname: '러너' });
  for (const activity_visibility of ['public', 'crew', 'private']) assert.equal(profileInput({ ...form, activity_visibility }).activity_visibility, activity_visibility);
  for (const patch of [{ nickname: 'a' }, { nickname: 'a'.repeat(21) }, { nickname: 'ab\ncd' }, { activity_visibility: 'all' }, { show_crews: 'false' }]) assert.throws(() => profileInput({ ...form, ...patch }));
});
test('profile updates only the caller and reports absent rows or denied writes', async () => {
  const { db, calls } = mock({ id, ...form }); await savePublicProfile(db, id, form);
  assert.ok(calls.some(x => x[0] === 'eq' && x[1] === 'id' && x[2] === id));
  assert.deepEqual(calls.find(x => x[0] === 'update')[1], { ...form, nickname: '러너' });
  await assert.rejects(savePublicProfile(mock(null).db, id, form), /저장하지/);
  await assert.rejects(savePublicProfile(mock(null, { code: '42501' }).db, id, form), /저장하지/);
});
test('member card selects public fields only, distinguishes missing and failed reads', async () => {
  const { db, calls } = mock(null); assert.equal(await loadMember(db, id), null);
  assert.equal(calls.find(x => x[0] === 'select')[1], 'id,nickname,main_sport,level,activity_visibility,show_crews');
  await assert.rejects(loadMember(mock(null, new Error('denied')).db, id), /denied/);
  await assert.rejects(loadMember({}, 'invalid'), /회원 주소/);
});
test('record summary pages preserve big IDs and never query routes or notes', async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ id: String(9007199254741999n - BigInt(i)), performed_on: '2026-09-30' }));
  const { db, calls } = mock(rows), page = await loadMemberRecords(db, id);
  assert.equal(page.rows.length, 20); assert.equal(page.next.id, rows[19].id);
  assert.equal(calls.find(x => x[0] === 'select')[1], 'id,sport,performed_on,duration_sec,distance_m');
  const next = mock([]); assert.equal((await loadMemberRecords(next.db, id, page.next)).next, undefined);
  assert.ok(next.calls.some(x => x[0] === 'or' && x[1].includes('id.lt.' + rows[19].id)));
  await assert.rejects(loadMemberRecords({}, id, { id: '1),id.gt.0', date: '2026-09-30' }));
});
test('crew membership query excludes pending and relies on RLS for shared hidden crews', async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ crew_id: i + 1, crews: { name: '크루' } }));
  const { db, calls } = mock(rows), page = await loadMemberCrews(db, id);
  assert.equal(page.next, '20'); assert.equal(page.rows.length, 20);
  assert.ok(calls.some(x => x[0] === 'eq' && x[1] === 'status' && x[2] === 'approved'));
  assert.ok(!calls.some(x => x.includes('show_crews')));
  const next = mock([]); await loadMemberCrews(next.db, id, page.next);
  assert.ok(next.calls.some(x => x[0] === 'gt' && x[1] === 'crew_id' && x[2] === '20'));
});
test('list errors are not confused with private or empty results', async () => {
  for (const load of [loadMemberRecords, loadMemberCrews]) {
    await assert.rejects(load(mock(null, new Error('offline')).db, id), /offline/);
    await assert.rejects(load(mock({}).db, id));
    assert.deepEqual((await load(mock([]).db, id)).rows, []);
  }
});
test('member caches are isolated by viewer as well as target', () => {
  for (const key of [queryKeys.member, queryKeys.memberRecords, queryKeys.memberCrews]) {
    assert.notDeepEqual(key('a', id), key('b', id));
    assert.notDeepEqual(key('a', id), key('a', 'other'));
  }
});
