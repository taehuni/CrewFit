import test from 'node:test';
import assert from 'node:assert/strict';
import { changeGoal, emptyGoal, goalForm, goalPayload, invalidateGoals, loadGoals, saveGoal } from './goals.js';

test('goal form converts km/min to stored m/sec and preserves edit units', () => {
  assert.deepEqual(goalPayload({ ...emptyGoal(), target: '3' }), { type: 'count', sport: null, period: 'week', target: 3, is_active: true });
  assert.equal(goalPayload({ ...emptyGoal(), type: 'distance', sport: 'swimming', target: '0.5' }).target, 500);
  assert.equal(goalPayload({ ...emptyGoal(), type: 'duration', target: '30.5' }).target, 1830);
  const row = { type: 'duration', target: 1830, sport: null, period: 'month', is_active: false };
  assert.deepEqual(goalPayload(goalForm(row)), row);
});
test('rejects blank, zero, negative, non-finite, fractional count and invalid choices', () => {
  for (const target of ['', ' ', '0', '-1', 'NaN', 'Infinity', '1e9', '1.5', '9007199254740992'])
    assert.throws(() => goalPayload({ ...emptyGoal(), target }));
  for (const values of [{ type: 'constructor' }, { sport: 'golf' }, { period: 'year' }])
    assert.throws(() => goalPayload({ ...emptyGoal(), target: '3', ...values }));
});

function mutationDB(data = { id: 5 }, error = null) {
  const calls = [];
  const q = {};
  for (const method of ['from', 'insert', 'update', 'delete', 'eq', 'select']) q[method] = (...args) => { calls.push([method, ...args]); return q; };
  q.maybeSingle = async () => ({ data, error });
  return { calls, ...q };
}
test('create overrides supplied owner; update/delete/pause are scoped and narrow', async () => {
  const db = mutationDB();
  await saveGoal(db, 'me', { ...emptyGoal(), target: '3', user_id: 'other' });
  assert.equal(db.calls.find(c => c[0] === 'insert')[1].user_id, 'me');
  for (const action of [db => saveGoal(db, 'me', { ...emptyGoal(), target: '4' }, 5), db => changeGoal(db, 'me', 5, false), db => changeGoal(db, 'me', 5, null)]) {
    const scoped = mutationDB(); await action(scoped);
    assert.ok(scoped.calls.some(c => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'me'));
    assert.ok(scoped.calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === 5));
    const update = scoped.calls.find(c => c[0] === 'update');
    if (update) assert.equal(Object.hasOwn(update[1], 'user_id'), false);
  }
});
test('missing rows, DB errors and invalid IDs cannot succeed', async () => {
  await assert.rejects(saveGoal(mutationDB(null), 'me', { ...emptyGoal(), target: '3' }, 5));
  await assert.rejects(changeGoal(mutationDB(null), 'me', 5, null));
  await assert.rejects(changeGoal(mutationDB(null, new Error('offline')), 'me', 5, true), /offline/);
  await assert.rejects(changeGoal(mutationDB(), 'me', '5 OR true', null));
});
test('list follows capped pages with user filter and cancellation', async () => {
  let calls = 0, cursor = 0;
  const signal = new AbortController().signal;
  const db = { from(table) {
    assert.equal(table, 'goals'); cursor = 0;
    const q = { select: () => q, eq: (k, v) => { assert.equal(k, 'user_id'); assert.equal(v, 'me'); return q; },
      order: () => q, limit: () => q, gt: (k, v) => { cursor = v; return q; }, abortSignal: s => { assert.equal(s, signal); return q; },
      then(resolve) { calls++; resolve({ data: cursor < 2 ? [{ id: cursor + 1 }] : [] }); } };
    return q;
  }};
  assert.deepEqual(await loadGoals(db, 'me', signal), [{ id: 1 }, { id: 2 }]);
  assert.equal(calls, 3);
});
test('mutations invalidate own goals and all dashboard weeks only', async () => {
  const keys = [];
  await invalidateGoals({ invalidateQueries: async ({ queryKey }) => keys.push(queryKey) }, 'me');
  assert.deepEqual(keys, [['goals', 'me'], ['dashboard', 'me']]);
});
