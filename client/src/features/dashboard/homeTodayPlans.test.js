import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { loadHomeTodayPlans } from './homeTodayPlans.js';
import { deleteActivity, invalidateActivityData } from '../activities/activityMutations.js';

const today = '2026-11-21';
function fixture({ planError, linkError, rejectLinks = false, empty = false } = {}) {
  const plans = empty ? [] : [
    { id: 'first', user_id: 'owner', scheduled_on: today, title: '아침 걷기', start_time: '08:00:00' },
    { id: 'second', user_id: 'owner', scheduled_on: today, title: '저녁 운동', start_time: '19:00:00' },
    { id: 'third', user_id: 'owner', scheduled_on: today, title: '스트레칭', start_time: '21:00:00' },
    { id: 'other', user_id: 'other-owner', scheduled_on: today, title: '다른 사람의 계획', start_time: '06:00:00' },
    { id: 'tomorrow', user_id: 'owner', scheduled_on: '2026-11-22', title: '내일 계획', start_time: '08:00:00' },
  ];
  let records = [{ plan_id: 'first', user_id: 'owner', activity_id: 17 },
    { plan_id: 'second', user_id: 'other-owner', activity_id: 18 }];
  let activities = [{ id: 17, user_id: 'owner' }, { id: 18, user_id: 'other-owner' }];
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const query = {
      select(columns, options) { call.columns = columns; call.options = options; return this; },
      eq(key, value) { call.filters.push([key, value]); return this; },
      in(key, values) { call.in = [key, values]; return this; },
      order(key, options) { call.orders.push([key, options]); return this; },
      limit(value) { call.limit = value; return this; },
      delete() { call.deleting = true; return this; },
      maybeSingle() { call.single = true; return this; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (table === 'workout_plans' && planError) return { error: planError };
          if (table === 'workout_plan_records' && rejectLinks) throw Error('fixture-offline');
          if (table === 'workout_plan_records' && linkError) return { error: linkError };
          const source = table === 'workout_plans' ? plans : table === 'workout_plan_records' ? records : activities;
          let rows = source.filter(row => call.filters.every(([key, value]) => String(row[key]) === String(value))
            && (!call.in || call.in[1].includes(row[call.in[0]])));
          for (const [key] of call.orders.slice().reverse()) rows = rows.slice().sort((a, b) => String(a[key]).localeCompare(String(b[key])));
          const count = rows.length;
          if (call.limit) rows = rows.slice(0, call.limit);
          if (call.deleting) {
            const removed = new Set(rows.map(row => row.id));
            activities = activities.filter(row => !removed.has(row.id));
            // Mirror the activity FK cascade in 20261118_plan_flow.sql.
            records = records.filter(row => !removed.has(row.activity_id));
          }
          return { data: call.single ? rows[0] || null : rows, count, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  } };
  return { db, calls };
}

test('home loads two plans for the selected owner/day and scopes completion to those plan IDs', async () => {
  const f = fixture();
  const result = await loadHomeTodayPlans(f.db, 'owner', today);
  assert.equal(result.count, 3);
  assert.deepEqual(result.plans.map(plan => [plan.id, plan.activity_id, plan.completion_available]),
    [['first', 17, true], ['second', null, true]]);
  assert.deepEqual(f.calls[0].filters, [['user_id', 'owner'], ['scheduled_on', today]]);
  assert.equal(f.calls[0].limit, 2);
  assert.deepEqual(f.calls[1].filters, [['user_id', 'owner']]);
  assert.deepEqual(f.calls[1].in, ['plan_id', ['first', 'second']]);
  assert.equal(f.calls[1].columns, 'plan_id,activity_id');
});

test('missing or unreachable completion data stays unknown instead of marking plans unfinished', async () => {
  for (const options of [{ linkError: { code: '42P01' } }, { rejectLinks: true }]) {
    const result = await loadHomeTodayPlans(fixture(options).db, 'owner', today);
    assert.equal(result.plans.length, 2);
    assert.ok(result.plans.every(plan => plan.completion_available === false && plan.activity_id === null));
  }
  const failed = fixture({ planError: Error('fixture-plan-failure') });
  await assert.rejects(loadHomeTodayPlans(failed.db, 'owner', today), /fixture-plan-failure/);
  assert.equal(failed.calls.length, 1);
});

test('empty days skip the completion query', async () => {
  const f = fixture({ empty: true });
  assert.deepEqual(await loadHomeTodayPlans(f.db, 'owner', today), { plans: [], count: 0 });
  assert.equal(f.calls.length, 1);
});

test('deleting a linked activity invalidates home and reloads the plan as unfinished', async () => {
  const f = fixture(), cache = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity, retry: false } } });
  const options = { queryKey: ['coach', 'owner', 'today', today], queryFn: () => loadHomeTodayPlans(f.db, 'owner', today) };
  const otherKey = ['coach', 'other-owner', 'today', today];
  cache.setQueryData(otherKey, { untouched: true });
  assert.equal((await cache.fetchQuery(options)).plans[0].activity_id, 17);
  await deleteActivity(f.db, 'owner', '17');
  await invalidateActivityData(cache, 'owner');
  assert.equal(cache.getQueryState(options.queryKey).isInvalidated, true);
  assert.equal(cache.getQueryState(otherKey).isInvalidated, false);
  const refreshed = await cache.fetchQuery(options);
  assert.equal(refreshed.plans[0].activity_id, null);
  assert.equal(refreshed.plans[0].completion_available, true);
  cache.clear();
});
