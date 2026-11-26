import test from 'node:test';
import assert from 'node:assert/strict';
import { ingredientStoreLink, loadReviewTurn, mealDate, proposalMealReturn, safeMealReturn, savedMealReturn } from './mealReturn.js';
const id = '12345678-1234-4234-8234-123456789abc';
test('unsaved proposal return keeps the original conversation and selected meal through product URLs', () => {
  const original = proposalMealReturn(id, 2);
  const store = new URL(ingredientStoreLink('두부', original), 'https://crewfit.example');
  assert.equal(store.searchParams.get('q'), '두부');
  assert.equal(safeMealReturn(store.searchParams.get('meal_return')), original);
  const detail = new URL('/store/products/123?' + store.searchParams, store.origin);
  assert.equal(safeMealReturn(detail.searchParams.get('meal_return')), original);
  assert.match(original, /meal=2#meal-proposal-/);
});
test('saved meal return restores its date and card, rejects unsafe locations and invalid dates', () => {
  assert.equal(safeMealReturn(savedMealReturn('2026-11-03', id)), '/meals?view=plans&date=2026-11-03#meal-plan-' + id);
  for (const path of ['https://example.com', '//example.com', '/\\example.com', '/me/settings', '/coach?review=bad']) assert.equal(safeMealReturn(path), '/meals?view=plans');
  assert.equal(mealDate('2026-02-30', 'today'), 'today');
  assert.equal(mealDate('2028-02-29', 'today'), '2028-02-29');
  assert.doesNotMatch(safeMealReturn('/meals?date=2026-11-03&token=secret#meal-plan-' + id), /token|secret/);
});
test('recovering an older proposal queries only the current owner and reports read failures', async () => {
  const calls = [], query = { select() { return this; }, eq(...args) { calls.push(args); return this; }, abortSignal() { return this; }, async maybeSingle() { return { data: { id } }; } };
  const db = { from(table) { assert.equal(table, 'coach_turns'); return query; } };
  assert.deepEqual(await loadReviewTurn(db, 'owner', id), { id });
  assert.deepEqual(calls, [['user_id', 'owner'], ['id', id]]);
  assert.equal(await loadReviewTurn(db, 'owner', 'invalid'), null);
  query.maybeSingle = async () => ({ error: { message: 'private database detail' } });
  await assert.rejects(() => loadReviewTurn(db, 'owner', id), /원래 식단 제안/);
});
