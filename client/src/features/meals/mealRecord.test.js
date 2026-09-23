import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeal, deleteMeal, emptyMealItem, invalidateMeals, loadMealDetail, loadMealPage, mealFormValues, mealPayload, updateMeal, visibleMealItems } from './mealRecord.js';
import { queryKeys } from '../../shared/queryKeys.js';

const valid = { date: '2026-09-16', type: 'lunch', items: [{ name: ' 현미밥 ', amount: ' 1공기 ', kcal: '300' }, { name: '물', amount: '', kcal: '0' }], note: ' 든든함 ' };
test('payload trims values, preserves optional/null and accepts zero kcal', () => {
  const result = mealPayload(valid);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.meal, { eaten_on: '2026-09-16', meal_type: 'lunch', items: [
    { name: '현미밥', amount: '1공기', kcal: 300 }, { name: '물', amount: null, kcal: 0 },
  ], note: '든든함' });
  assert.deepEqual(mealPayload({ ...valid, note: '', items: [{ name: '사과', amount: '', kcal: '' }] }).meal.items[0], { name: '사과', amount: null, kcal: null });
});
test('payload rejects invalid dates/types/items, excessive text and malformed kcal', () => {
  for (const date of ['', '2026-02-30', 'bad']) assert.ok(mealPayload({ ...valid, date }).errors.date);
  assert.ok(mealPayload({ ...valid, type: 'brunch' }).errors.type);
  assert.ok(mealPayload({ ...valid, items: [] }).errors.items);
  assert.ok(mealPayload({ ...valid, items: Array.from({ length: 31 }, emptyMealItem) }).errors.items);
  assert.ok(mealPayload({ ...valid, items: [{ name: ' ', amount: 'a'.repeat(101), kcal: '1.5' }] }).errors['name-0']);
  assert.ok(mealPayload({ ...valid, items: [{ name: 'a', amount: '', kcal: '-1' }] }).errors['kcal-0']);
  assert.ok(mealPayload({ ...valid, note: 'a'.repeat(1001) }).errors.note);
});
test('edit form round-trip retains zero and missing optional values', () => {
  const detail = { eaten_on: '2026-09-16', meal_type: 'snack', items: [{ name: '물', amount: null, kcal: 0 }, { name: '바나나' }], note: null };
  const form = mealFormValues(detail);
  assert.equal(form.items[0].kcal, '0'); assert.equal(form.items[1].kcal, '');
  assert.deepEqual(mealPayload(form).meal, { ...detail, items: [{ name: '물', amount: null, kcal: 0 }, { name: '바나나', amount: null, kcal: null }] });
});

function pageDb(source, cap = 1000, failAt = Infinity) {
  const calls = [];
  return { calls, from(table) {
    const state = { table, filters: [], order: [] }; calls.push(state);
    const q = { select: fields => { state.fields = fields; return q; }, eq: (key, value) => { state.filters.push([key, value]); return q; },
      order: (key, options) => { state.order.push([key, options]); return q; }, limit: n => { state.limit = n; return q; }, or: value => { state.cursor = value; return q; }, abortSignal: value => { state.signal = value; return q; },
      then(resolve) {
        if (calls.length >= failAt) return Promise.resolve({ error: new Error('offline') }).then(resolve);
        let rows = source.filter(row => state.filters.every(([key, value]) => row[key] === value));
        if (state.cursor) { const [, date, id] = state.cursor.match(/^eaten_on.lt.([\d-]+),and\(eaten_on.eq.[\d-]+,id.lt.(\d+)\)$/); rows = rows.filter(row => row.eaten_on < date || (row.eaten_on === date && BigInt(row.id) < BigInt(id))); }
        rows.sort((a, b) => b.eaten_on.localeCompare(a.eaten_on) || b.id - a.id);
        return Promise.resolve({ data: rows.slice(0, Math.min(cap, state.limit)) }).then(resolve);
      } };
    return q;
  } };
}
const rows = Array.from({ length: 43 }, (_, i) => ({ id: i + 1, user_id: 'me', eaten_on: i < 28 ? '2026-09-16' : '2026-09-15', meal_type: 'lunch', items: [] }));
test('list pages by date/id across low row caps and filters every request by owner', async () => {
  const db = pageDb([...rows, { ...rows[0], id: 999, user_id: 'other' }], 6); const all = []; let cursor;
  do { const page = await loadMealPage(db, 'me', cursor); all.push(...page.items); cursor = page.nextCursor; } while (cursor);
  assert.equal(all.length, 43); assert.equal(new Set(all.map(row => row.id)).size, 43);
  assert.equal(all[0].id, 28); assert.equal(all.at(-1).id, 29);
  assert.ok(db.calls.every(call => call.filters.some(([key, value]) => key === 'user_id' && value === 'me')));
});
test('list supports cancellation and never returns partial pages after failure', async () => {
  const signal = new AbortController().signal, db = pageDb(rows, 5);
  await loadMealPage(db, 'me', null, signal); assert.ok(db.calls.every(call => call.signal === signal));
  await assert.rejects(loadMealPage(pageDb(rows, 5, 2), 'me'), /offline/);
  await assert.rejects(loadMealPage(pageDb(rows), 'me', { date: '2026-09-16', id: '1),id.gt.0' }));
});

function mutationDb(result = { data: { id: 7 }, error: null }) {
  const calls = [], q = { eq: (...args) => { calls.push(['eq', ...args]); return q; }, select: () => q, maybeSingle: async () => result };
  return { calls, from: table => ({ insert: body => { calls.push(['insert', table, body]); return q; }, update: body => { calls.push(['update', table, body]); return q; }, delete: () => { calls.push(['delete', table]); return q; }, select: () => q }) };
}
test('create fixes owner; update and delete scope by both id and owner', async () => {
  const meal = mealPayload(valid).meal, created = mutationDb(); await createMeal(created, 'me', { ...meal, user_id: 'other' });
  assert.equal(created.calls[0][2].user_id, 'me');
  for (const action of [db => updateMeal(db, 'me', 7, meal), db => deleteMeal(db, 'me', 7)]) { const db = mutationDb(); await action(db); assert.ok(db.calls.some(call => call[0] === 'eq' && call[1] === 'id' && call[2] === 7)); assert.ok(db.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'me')); }
});
test('missing rows, invalid ids and database errors cannot report success', async () => {
  const meal = mealPayload(valid).meal;
  await assert.rejects(updateMeal(mutationDb({ data: null }), 'me', 7, meal), error => error.code === 'not_found');
  await assert.rejects(deleteMeal(mutationDb({ data: null }), 'me', 7), error => error.code === 'not_found');
  await assert.rejects(deleteMeal(mutationDb({ error: new Error('offline') }), 'me', 7), /offline/);
  const untouched = mutationDb(); await assert.rejects(deleteMeal(untouched, 'bad')); assert.deepEqual(untouched.calls, []);
});
test('detail treats invalid/missing/other records alike and filters owner', async () => {
  let calls = 0; const db = { from: () => { calls++; const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null }) }; return q; } };
  assert.equal(await loadMealDetail(db, 'me', 'bad'), null); assert.equal(calls, 0);
  assert.equal(await loadMealDetail(db, 'me', '7'), null); assert.equal(calls, 1);
});
test('visible items tolerate malformed legacy JSON and cache invalidation is account scoped', async () => {
  assert.deepEqual(visibleMealItems([null, {}, { name: ' 사과 ', amount: ' 1개 ', kcal: 50 }, { name: '물', kcal: -1 }]), [{ name: '사과', amount: '1개', kcal: 50 }, { name: '물', amount: null, kcal: null }]);
  const keys = []; await invalidateMeals({ invalidateQueries: async ({ queryKey }) => keys.push(queryKey) }, 'me');
  assert.deepEqual(keys, [queryKeys.mealsRoot('me')]);
});
