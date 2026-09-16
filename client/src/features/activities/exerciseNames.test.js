import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISE_SEEDS, exerciseSuggestions, loadExerciseNames } from './exerciseNames.js';
import { queryKeys } from '../../shared/queryKeys.js';

test('30 seed names; own names precede seeds and deduplicate by trim/case only', () => {
  assert.equal(EXERCISE_SEEDS.length, 30);
  assert.equal(new Set(EXERCISE_SEEDS).size, 30);
  const result = exerciseSuggestions([' Squat ', 'squat', '스쿼트', '벤치 프레스', null, ''], '', 40);
  assert.deepEqual(result.slice(0, 3), [
    { name: 'Squat', source: 'history' }, { name: '스쿼트', source: 'history' }, { name: '벤치 프레스', source: 'history' },
  ]);
  assert.equal(result.filter(row => row.name === '스쿼트').length, 1);
  assert.ok(result.some(row => row.name === '벤치프레스' && row.source === 'seed'));
});
test('suggestions filter substrings case-insensitively, cap at eight, allow unmatched free input', () => {
  assert.deepEqual(exerciseSuggestions(['My Squat'], ' SQU '), [{ name: 'My Squat', source: 'history' }]);
  assert.equal(exerciseSuggestions([], '').length, 8);
  assert.deepEqual(exerciseSuggestions([], '나만의 운동 이름'), []);
  assert.deepEqual(exerciseSuggestions(['x'.repeat(101)], 'xxx'), []);
});
function mockDB(pages) {
  const calls = [];
  return { calls, from(table) {
    const call = { table }; calls.push(call);
    const query = {
      select(value) { call.select = value; return this; },
      eq(...value) { call.eq = value; return this; },
      order(...value) { call.order = value; return this; },
      limit(value) { call.limit = value; return this; },
      lt(...value) { call.lt = value; return this; },
      abortSignal(value) { call.signal = value; return this; },
      then(resolve, reject) { return Promise.resolve(pages.shift() ?? { data: [] }).then(resolve, reject); },
    };
    return query;
  } };
}
test('own history pages until empty even with a lower server cap; latest spelling retained', async () => {
  const db = mockDB([
    { data: [{ id: '9', exercise_name: ' Squat ' }, { id: '8', exercise_name: '스쿼트' }] },
    { data: [{ id: '7', exercise_name: 'squat' }, { id: '6', exercise_name: '벤치프레스' }] },
  ]);
  const signal = new AbortController().signal;
  assert.deepEqual(await loadExerciseNames(db, 'owner', signal), ['Squat', '스쿼트', '벤치프레스']);
  assert.equal(db.calls.length, 3);
  for (const call of db.calls) {
    assert.equal(call.table, 'exercise_sets');
    assert.equal(call.select, 'id,exercise_name');
    assert.deepEqual(call.eq, ['user_id', 'owner']);
    assert.deepEqual(call.order, ['id', { ascending: false }]);
    assert.equal(call.limit, 500);
    assert.equal(call.signal, signal);
  }
  assert.deepEqual(db.calls[1].lt, ['id', '8']);
  assert.deepEqual(db.calls[2].lt, ['id', '6']);
});
test('history fails on errors or invalid/repeated cursor without publishing partial names', async () => {
  await assert.rejects(loadExerciseNames(mockDB([]), ''), /missing_user/);
  await assert.rejects(loadExerciseNames(mockDB([{ data: null }]), 'owner'), /invalid_exercise_names/);
  await assert.rejects(loadExerciseNames(mockDB([{ data: [{ id: 'x', exercise_name: 'Squat' }] }]), 'owner'), /invalid_exercise_cursor/);
  await assert.rejects(loadExerciseNames(mockDB([
    { data: [{ id: 2, exercise_name: 'Squat' }] }, { data: [{ id: 2, exercise_name: 'Bench' }] },
  ]), 'owner'), /invalid_exercise_cursor/);
  await assert.rejects(loadExerciseNames(mockDB([
    { data: [{ id: 2, exercise_name: 'Squat' }] }, { error: new Error('offline') },
  ]), 'owner'), /offline/);
});
test('history cache is user-scoped and covered by activity mutation invalidation', () => {
  assert.notDeepEqual(queryKeys.exerciseNames('a'), queryKeys.exerciseNames('b'));
  assert.deepEqual(queryKeys.exerciseNames('a').slice(0, 2), queryKeys.activitiesRoot('a'));
});
