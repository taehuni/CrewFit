import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRouter } from 'react-router';
import { createUnsavedFormState } from './unsavedFormState.js';

test('prefilled values start clean, nested edits guard, reverting clears the guard', () => {
  const original = { date: '2026-11-16', items: [{ name: '테스트 음식', amount: '' }], note: '' };
  const state = createUnsavedFormState(original);
  assert.equal(state.isDirty(), false);
  state.update({ ...original, items: [{ name: '테스트 음식', amount: '1' }] });
  assert.equal(state.isDirty(), true);
  state.update(structuredClone(original));
  assert.equal(state.isDirty(), false);
});

test('attachment, visibility and route-only changes are protected', () => {
  const initial = { content: '', visibility: 'public', activityId: null, includeRoute: false, hasPhoto: false, removedExisting: false };
  for (const change of [{ visibility: 'crew' }, { activityId: 'test' }, { includeRoute: true }, { hasPhoto: true }, { removedExisting: true }]) {
    const state = createUnsavedFormState(initial);
    state.update({ ...initial, ...change });
    assert.equal(state.isDirty(), true);
  }
});

test('failed save keeps protection and success releases navigation synchronously', async t => {
  const router = createMemoryRouter([{ path: '*' }], { initialEntries: ['/meals/new'] });
  t.after(() => router.dispose());
  const state = createUnsavedFormState({ note: '' });
  state.update({ note: '테스트 입력' });
  router.getBlocker('form', state.isDirty);
  await assert.rejects(Promise.reject(new Error('mock save failure')));
  await router.navigate('/meals');
  assert.equal(router.state.blockers.get('form').state, 'blocked');
  router.state.blockers.get('form').reset();
  state.markSaved();
  await router.navigate('/meals/test', { replace: true });
  assert.equal(router.state.location.pathname, '/meals/test');
  assert.equal(state.isDirty(), false);
  state.update({ note: '다시 작성한 테스트 입력' });
  assert.equal(state.isDirty(), true);
});
