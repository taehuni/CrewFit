import test from 'node:test';
import assert from 'node:assert/strict';
import { goalRanges, goalValue, loadGoalProgress } from './goalProgress.js';

function database(tables, cap = 2, failAt = Infinity) {
  const calls = [];
  return { calls, from(table) {
    const filters = [];
    const q = {
      select: () => q, order: () => q, limit: () => q,
      eq: (key, value) => { filters.push([key, '=', value]); return q; },
      gte: (key, value) => { filters.push([key, '>=', value]); return q; },
      lte: (key, value) => { filters.push([key, '<=', value]); return q; },
      gt: (key, value) => { filters.push([key, '>', value]); return q; },
      then(resolve, reject) {
        calls.push({ table, filters });
        const data = tables[table].filter(row => filters.every(([key, op, value]) =>
          op === '=' ? row[key] === value : op === '>' ? row[key] > value : op === '>=' ? row[key] >= value : row[key] <= value))
          .sort((a, b) => a.id - b.id).slice(0, cap);
        return Promise.resolve(calls.length >= failAt ? { error: new Error('offline') } : { data }).then(resolve, reject);
      },
    };
    return q;
  }};
}
const now = new Date('2026-09-16T03:00:00Z');
const goal = (id, type = 'count', period = 'week', sport = null, target = 3) => ({ id, user_id: 'me', type, period, sport, target, is_active: true });
const activity = (id, date, sport = 'running', distance = 1000) => ({ id, user_id: 'me', performed_on: date, sport, distance_m: distance, duration_sec: 120 });

test('KST week/month boundaries include leap days and year rollover', () => {
  assert.deepEqual(goalRanges(new Date('2024-02-28T15:00:00Z')).month, { from: '2024-02-01', to: '2024-02-29' });
  const ranges = goalRanges(new Date('2026-12-31T15:00:00Z'));
  assert.deepEqual(ranges.month, { from: '2027-01-01', to: '2027-01-31' });
  assert.deepEqual(ranges.week, { from: '2026-12-28', to: '2027-01-03' });
  assert.equal(goalRanges(new Date('2026-09-13T15:00:00Z')).week.from, '2026-09-14');
});
test('count counts records rather than unique dates; distance ignores NULL; sport filter applies', () => {
  const rows = [activity(1, '2026-09-14'), activity(2, '2026-09-14', 'gym', null)];
  assert.equal(goalValue(goal(1), rows), 2);
  assert.equal(goalValue(goal(1, 'count', 'week', 'gym'), rows), 1);
  assert.equal(goalValue(goal(1, 'distance'), rows), 1000);
  assert.equal(goalValue(goal(1, 'duration'), rows), 240);
});
test('active own goals and each current period aggregate all pages, including >100% progress', async () => {
  const db = database({ goals: [goal(1), goal(2, 'distance', 'month', 'running', '2000'), goal(3, 'duration', 'week', 'gym', 60),
    { ...goal(4), is_active: false }, { ...goal(5), user_id: 'other' }], activities: [
    activity(1, '2026-09-01'), activity(2, '2026-09-14'), activity(3, '2026-09-20'), activity(4, '2026-09-16', 'gym', null),
    activity(5, '2026-08-31'), activity(6, '2026-10-01'), { ...activity(7, '2026-09-16'), user_id: 'other' },
  ] });
  const results = await loadGoalProgress(db, 'me', now);
  assert.equal(results.length, 3);
  assert.deepEqual(results.map(row => row.current), [3, 3000, 120]);
  assert.deepEqual(results.map(row => row.progress), [1, 1.5, 2]);
  assert.deepEqual(results.map(row => row.from), ['2026-09-14', '2026-09-01', '2026-09-14']);
  assert.ok(db.calls.every(call => call.filters.some(([key, op, value]) => key === 'user_id' && op === '=' && value === 'me')));
});
test('no goals skips activity queries; partial errors are not successful progress', async () => {
  const empty = database({ goals: [], activities: [] });
  assert.deepEqual(await loadGoalProgress(empty, 'me', now), []);
  assert.equal(empty.calls.length, 1);
  await assert.rejects(loadGoalProgress(database({ goals: [goal(1)], activities: [] }, 2, 2), 'me', now), /offline/);
  const data = { goals: [goal(1)], activities: [activity(1, '2026-09-14'), activity(2, '2026-09-15')] };
  await assert.rejects(loadGoalProgress(database(data, 1, 4), 'me', now), /offline/);
});
test('zero records return zero progress; non-finite target is rejected', async () => {
  const results = await loadGoalProgress(database({ goals: [goal(1)], activities: [] }), 'me', now);
  assert.equal(results[0].current, 0);
  assert.equal(results[0].progress, 0);
  await assert.rejects(loadGoalProgress(database({ goals: [goal(1, 'count', 'week', null, 'NaN')], activities: [] }), 'me', now), /invalid_goal/);
});
