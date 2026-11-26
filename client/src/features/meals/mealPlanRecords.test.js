import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMealPlanRecords } from './mealPlanRecords.js';

const ids = [1, 2, 3].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
function mockDb(rows, failAt = Infinity) {
  const calls = [];
  return { calls, from(table) {
    const state = { table, filters: [] }; calls.push(state);
    const q = { select: fields => { state.fields = fields; return q; }, eq: (key, value) => { state.filters.push([key, value]); return q; },
      in: (key, values) => { state.membership = [key, values]; return q; }, order: () => q, limit: () => q,
      gt: (_, value) => { state.after = value; return q; }, abortSignal: signal => { state.signal = signal; return q; },
      then(resolve) {
        if (calls.length >= failAt) return Promise.resolve({ error: new Error('offline') }).then(resolve);
        const result = rows.filter(row => state.filters.every(([key, value]) => row[key] === value)
          && state.membership[1].includes(row[state.membership[0]]) && (!state.after || BigInt(row.id) > BigInt(state.after)));
        return Promise.resolve({ data: result.slice(0, 1) }).then(resolve);
      } };
    return q;
  } };
}
const rows = ids.map((id, index) => ({ id: index + 1, user_id: 'me', source_meal_plan_id: id, eaten_on: '2026-11-21' }));
test('recorded plan lookup paginates and isolates the owner and requested plans', async () => {
  const signal = new AbortController().signal;
  const db = mockDb([...rows, { ...rows[0], id: 9, user_id: 'other' }]);
  const records = await loadMealPlanRecords(db, 'me', ids.slice(0, 2), signal);
  assert.deepEqual(Object.keys(records), ids.slice(0, 2));
  assert.equal(records[ids[0]].id, 1);
  assert.equal(db.calls.length, 3);
  assert.ok(db.calls.every(call => call.filters.some(([key, value]) => key === 'user_id' && value === 'me') && call.signal === signal));
});
test('lookup returns no partial success on errors and skips empty/invalid inputs', async () => {
  await assert.rejects(loadMealPlanRecords(mockDb(rows, 2), 'me', ids), /offline/);
  const db = mockDb(rows);
  assert.deepEqual(await loadMealPlanRecords(db, 'me', []), {});
  await assert.rejects(loadMealPlanRecords(db, 'me', ['invalid']));
  await assert.rejects(loadMealPlanRecords(db, '', ids));
  assert.equal(db.calls.length, 0);
});
