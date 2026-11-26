import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionDrafts, DRAFT_LIFETIME } from './sessionDrafts.js';
function storage() {
  const rows = new Map();
  return { get length() { return rows.size; }, key: i => [...rows.keys()][i],
    getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) };
}
test('question survives remount and reload only for its owner and expires after 30 minutes', () => {
  const tab = storage(); let now = 100;
  const first = createSessionDrafts(tab, () => now);
  assert.equal(first.write('a', '다음 주 운동 질문'), true);
  assert.equal(createSessionDrafts(tab, () => now).read('a'), '다음 주 운동 질문');
  assert.equal(first.read('b'), '');
  now += DRAFT_LIFETIME;
  assert.equal(first.read('a'), '');
  assert.equal(tab.length, 0);
});
test('account changes and sign-out erase drafts without touching other session state', () => {
  const tab = storage(), drafts = createSessionDrafts(tab);
  tab.setItem('other-feature', 'keep');
  drafts.write('a', 'question'); drafts.retainOwner('b');
  assert.equal(drafts.read('a'), '');
  drafts.write('b', 'another question'); drafts.retainOwner(null);
  assert.equal(drafts.read('b'), ''); assert.equal(tab.getItem('other-feature'), 'keep');
});
test('successful send clears the question and blocked storage is reported for leave protection', () => {
  const tab = storage(), drafts = createSessionDrafts(tab);
  drafts.write('a', 'question'); drafts.write('a', '');
  assert.equal(drafts.read('a'), ''); assert.equal(tab.length, 0);
  assert.equal(createSessionDrafts().write('a', 'question'), false);
  assert.equal(createSessionDrafts({ setItem() { throw Error('blocked'); } }).write('a', 'question'), false);
});
