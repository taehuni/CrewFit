import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStreak, loadStreak, loadWeeklyDashboard, weekRange } from './dashboard.js';

function database(rows, cap = 500, failAfter = Infinity) {
  let calls = 0;
  const filters = [];
  return { filters, from(table) {
    assert.equal(table, 'activities');
    let cursor = 0, from = null, to = null;
    const q = {
      select: () => q, eq: (key, value) => { filters.push([key, value]); return q; },
      gte: (key, value) => { if (key === 'performed_on') from = value; return q; },
      lte: (key, value) => { if (key === 'performed_on') to = value; return q; }, order: () => q, limit: () => q,
      gt: (key, value) => { assert.equal(key, 'id'); cursor = value; return q; },
      then(resolve, reject) { return Promise.resolve(++calls > failAfter ? { error: new Error('offline') } : { data: rows.filter(row => row.id > cursor && (!from || row.performed_on >= from) && (!to || row.performed_on <= to)).slice(0, cap) }).then(resolve, reject); },
    };
    return q;
  }};
}
test('week range uses KST and rejects malformed/overflow dates', () => {
  assert.equal(weekRange(undefined, new Date('2026-09-13T15:00:00Z')).from, '2026-09-14');
  assert.equal(weekRange('2026-09-13').from, '2026-09-07');
  for (const value of ['2026-02-30', 'bad', '', ['2026-09-13'], '0000-01-01']) assert.throws(() => weekRange(value));
});
test('aggregates every row past 50/1000 and a lower database row cap', async () => {
  const rows = Array.from({length: 1051}, (_, i) => ({id: i + 1, sport: 'running', performed_on: '2026-09-13', distance_m: 1000, duration_sec: 60}));
  const db = database(rows, 127);
  const result = await loadWeeklyDashboard(db, 'me', weekRange('2026-09-13'));
  assert.deepEqual(result.totals, {activity_count: 1051, distance_m: 1051000, duration_sec: 63060});
  assert.equal(result.recent.length, 50);
  assert.equal(result.recent[0].id, 1051);
  assert.equal(result.days[6].activity_count, 1051);
  assert.ok(db.filters.every(([key, value]) => key === 'user_id' && value === 'me'));
});
test('successful empty data is zero, partial fetch failure rejects instead', async () => {
  const range = weekRange('2026-09-13');
  const empty = await loadWeeklyDashboard(database([]), 'me', range);
  assert.equal(empty.totals.activity_count, 0);
  const row = {id: 1, sport: 'gym', performed_on: '2026-09-13', distance_m: null, duration_sec: 3600};
  const gym = await loadWeeklyDashboard(database([row]), 'me', range);
  assert.equal(gym.totals.distance_m, 0);
  await assert.rejects(loadWeeklyDashboard(database([row], 1, 1), 'me', range), /offline/);
});
test('recent rows are sorted by performed date, not creation order', async () => {
  const rows = [{id: 1, performed_on: '2026-09-13', distance_m: 0, duration_sec: 1}, {id: 2, performed_on: '2026-09-07', distance_m: 0, duration_sec: 1}];
  const result = await loadWeeklyDashboard(database(rows, 1), 'me', weekRange('2026-09-13'));
  assert.equal(result.recent[0].id, 1);
});
test('streak uses unique KST dates, gives today grace, and keeps historical best', () => {
  const today = '2026-09-16';
  assert.deepEqual(calculateStreak([], today), { current: 0, best: 0, today_done: false });
  assert.deepEqual(calculateStreak(['2026-09-14', '2026-09-15', '2026-09-15'], today), { current: 2, best: 2, today_done: false });
  assert.deepEqual(calculateStreak(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-15', '2026-09-16'], today), { current: 2, best: 3, today_done: true });
  assert.deepEqual(calculateStreak(['bad', '2026-02-30', '2026-09-17'], today), { current: 0, best: 0, today_done: false });
});
test('streak loads all own dates across capped pages, excludes future records, and uses KST today', async () => {
  const rows = [
    { id: 1, performed_on: '2026-09-13' }, { id: 2, performed_on: '2026-09-14' },
    { id: 3, performed_on: '2026-09-15' }, { id: 4, performed_on: '2026-09-16' },
    { id: 5, performed_on: '2026-09-17' },
  ];
  const db = database(rows, 2);
  assert.deepEqual(await loadStreak(db, 'me', new Date('2026-09-16T03:00:00Z')), { current: 4, best: 4, today_done: true });
  assert.ok(db.filters.every(([key, value]) => key === 'user_id' && value === 'me'));
});
test('streak query failures never return a partial result', async () => {
  const rows = [{ id: 1, performed_on: '2026-09-15' }, { id: 2, performed_on: '2026-09-16' }];
  await assert.rejects(loadStreak(database(rows, 1, 1), 'me', new Date('2026-09-16T03:00:00Z')), /offline/);
  await assert.rejects(loadStreak(database(rows, 1, 2), 'me', new Date('2026-09-16T03:00:00Z')), /offline/);
});
