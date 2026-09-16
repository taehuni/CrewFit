import test from 'node:test';
import assert from 'node:assert/strict';
import { loadExerciseCatalog, exerciseMergePreview } from './exerciseMerge.js';
import { queryKeys } from '../../shared/queryKeys.js';

function mockDB(pages) {
  const calls = [];
  return { calls, from(table) {
    const call = { table }; calls.push(call);
    return {
      select(value) { call.select = value; return this; },
      eq(...args) { call.eq = args; return this; }, order(...args) { call.order = args; return this; },
      limit(value) { call.limit = value; return this; }, lt(...args) { call.lt = args; return this; },
      abortSignal(value) { call.signal = value; return this; },
      then(resolve, reject) { return Promise.resolve(pages.shift() ?? { data: [] }).then(resolve, reject); },
    };
  } };
}
test('catalog counts distinct activities and all sets over low-cap pages, own filter on every query', async () => {
  const db = mockDB([
    { data: [{ id: 5, activity_id: 11, exercise_name: 'Squat' }, { id: 4, activity_id: 11, exercise_name: 'squat' }] },
    { data: [{ id: 3, activity_id: 10, exercise_name: 'SQUAT' }, { id: 2, activity_id: 10, exercise_name: 'Bench' }] },
  ]);
  const signal = new AbortController().signal;
  assert.deepEqual(await loadExerciseCatalog(db, 'owner', signal), [
    { name: 'Squat', activityCount: 2, setCount: 3 }, { name: 'Bench', activityCount: 1, setCount: 1 },
  ]);
  assert.equal(db.calls.length, 3);
  for (const call of db.calls) {
    assert.equal(call.table, 'exercise_sets'); assert.deepEqual(call.eq, ['user_id', 'owner']);
    assert.equal(call.signal, signal); assert.equal(call.limit, 500);
  }
  assert.deepEqual(db.calls[1].lt, ['id', '4']);
});
test('catalog empty/error/malformed/cursor cases cannot publish partial counts', async () => {
  assert.deepEqual(await loadExerciseCatalog(mockDB([]), 'owner'), []);
  await assert.rejects(loadExerciseCatalog(mockDB([]), null), /missing_user/);
  for (const data of [null, [{ id: 'x', activity_id: 1, exercise_name: 'x' }], [{ id: 1, activity_id: 1, exercise_name: '' }],
    [{ id: 2, activity_id: 1, exercise_name: 'a' }, { id: 2, activity_id: 1, exercise_name: 'b' }]]) {
    await assert.rejects(loadExerciseCatalog(mockDB([{ data }]), 'owner'), /invalid_exercise_catalog/);
  }
  await assert.rejects(loadExerciseCatalog(mockDB([{ data: [{ id: 1, activity_id: 1, exercise_name: 'a' }] }, { error: new Error('offline') }]), 'owner'), /offline/);
});
test('preview requires an existing source, valid different target, preserves literal names and counts', () => {
  const rows = [{ name: 'Bench', activityCount: 2, setCount: 6 }];
  assert.deepEqual(exerciseMergePreview(rows, 'bench', ' 100%_* 운동 '), { from: 'Bench', to: '100%_* 운동', activityCount: 2, setCount: 6 });
  for (const [from, to] of [['', 'b'], ['missing', 'b'], ['Bench', ' '], ['Bench', 'BENCH'], ['Bench', 'x'.repeat(101)]]) {
    assert.throws(() => exerciseMergePreview(rows, from, to));
  }
});
test('catalog query keys separate accounts and share activity root invalidation', () => {
  assert.notDeepEqual(queryKeys.exerciseCatalog('a'), queryKeys.exerciseCatalog('b'));
  assert.deepEqual(queryKeys.exerciseCatalog('a').slice(0, 2), queryKeys.activitiesRoot('a'));
});
