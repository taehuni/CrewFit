import test from 'node:test';
import assert from 'node:assert/strict';
import { activitiesReturnTo, filterError, listFilters, listURL, loadActivityPage } from './activityList.js';
import { queryKeys } from '../../shared/queryKeys.js';

const empty = { sport: '', from: '', to: '' };
function mockDb(source, cap = 1000, failAt = Infinity) {
  const calls = [];
  return { calls, from(table) {
    const state = { table, filters: [], order: [] }; calls.push(state);
    const q = {
      select: fields => { state.fields = fields; return q; },
      eq: (key, value) => { state.filters.push([key, value]); return q; },
      gte: (key, value) => { state.from = value; return q; },
      lte: (key, value) => { state.to = value; return q; },
      order: (key, options) => { state.order.push([key, options]); return q; },
      limit: n => { state.limit = n; return q; },
      or: value => { state.cursor = value; return q; },
      abortSignal: value => { state.signal = value; return q; },
      then(resolve) {
        if (calls.length >= failAt) return Promise.resolve({ error: new Error('offline') }).then(resolve);
        let rows = source.filter(row => state.filters.every(([key, val]) => row[key] === val)
          && (!state.from || row.performed_on >= state.from) && (!state.to || row.performed_on <= state.to));
        if (state.cursor) {
          const [, date, id] = state.cursor.match(/^performed_on.lt.([\d-]+),and\(performed_on.eq.[\d-]+,id.lt.(\d+)\)$/);
          rows = rows.filter(row => row.performed_on < date || (row.performed_on === date && BigInt(row.id) < BigInt(id)));
        }
        rows.sort((a, b) => b.performed_on.localeCompare(a.performed_on) || b.id - a.id);
        return Promise.resolve({ data: rows.slice(0, Math.min(cap, state.limit)) }).then(resolve);
      },
    };
    return q;
  } };
}
const sample = Array.from({ length: 47 }, (_, i) => ({
  id: i + 1, user_id: 'owner', sport: i % 2 ? 'gym' : 'running',
  performed_on: i < 30 ? '2026-09-14' : '2026-09-13', duration_sec: 1800, distance_m: null,
}));
test('URL filters validate dates, sport and inclusive range without silently broadening', () => {
  assert.equal(filterError(empty), '');
  for (const filters of [{ ...empty, sport: 'bad' }, { ...empty, from: '2026-02-30' }, { ...empty, from: '2026-09-15', to: '2026-09-14' }]) assert.ok(filterError(filters));
  const filters = { sport: 'gym', from: '2024-02-29', to: '2026-09-14' };
  assert.deepEqual(listFilters(new URLSearchParams(listURL(filters).split('?')[1])), filters);
  assert.equal(filterError(filters), '');
});
test('only local list return paths are accepted and extraneous parameters are dropped', () => {
  assert.equal(activitiesReturnTo({ activitiesReturnTo: 'https://example.com' }), null);
  assert.equal(activitiesReturnTo({ activitiesReturnTo: '/activities/new' }), null);
  assert.equal(activitiesReturnTo({ activitiesReturnTo: '/activities?sport=gym&extra=1' }), '/activities?sport=gym');
  assert.equal(activitiesReturnTo({ activitiesReturnTo: '/activities?sport=bad' }), '/activities');
});
test('20-row pages preserve date/id order across same-day rows and low DB row caps', async () => {
  const db = mockDb([...sample, { ...sample[0], id: 999, user_id: 'other' }], 7);
  const items = [];
  let cursor = null;
  do {
    const page = await loadActivityPage(db, 'owner', empty, cursor);
    assert.ok(page.items.length <= 20);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(items.length, 47);
  assert.equal(new Set(items.map(row => row.id)).size, 47);
  assert.equal(items[0].id, 30); assert.equal(items.at(-1).id, 31);
  for (const call of db.calls) {
    assert.equal(call.table, 'activities');
    assert.ok(call.filters.some(([key, value]) => key === 'user_id' && value === 'owner'));
    assert.deepEqual(call.order.map(([key]) => key), ['performed_on', 'id']);
  }
});
test('sport and both date bounds apply on every request; cancellation signal is forwarded', async () => {
  const db = mockDb(sample, 3);
  const signal = new AbortController().signal;
  const result = await loadActivityPage(db, 'owner', { sport: 'gym', from: '2026-09-14', to: '2026-09-14' }, null, signal);
  assert.equal(result.items.length, 15); assert.equal(result.nextCursor, undefined);
  for (const call of db.calls) {
    assert.equal(call.from, '2026-09-14'); assert.equal(call.to, '2026-09-14'); assert.equal(call.signal, signal);
    assert.ok(call.filters.some(([key, value]) => key === 'sport' && value === 'gym'));
  }
});
test('empty and exact-page results end pagination, failures never return partial success', async () => {
  assert.deepEqual(await loadActivityPage(mockDb([]), 'owner', empty), { items: [], nextCursor: undefined });
  const page = await loadActivityPage(mockDb(sample.slice(0, 20)), 'owner', empty);
  assert.equal(page.items.length, 20); assert.equal(page.nextCursor, undefined);
  await assert.rejects(loadActivityPage(mockDb(sample, 5, 2), 'owner', empty), /offline/);
});
test('invalid filters and cursors are rejected before querying; cache is member/filter scoped', async () => {
  const db = mockDb(sample);
  await assert.rejects(loadActivityPage(db, 'owner', { ...empty, sport: 'bad' }));
  await assert.rejects(loadActivityPage(db, 'owner', empty, { date: '2026-09-14', id: '1),id.gt.0' }));
  assert.equal(db.calls.length, 0);
  assert.notDeepEqual(queryKeys.activityList('a', empty), queryKeys.activityList('b', empty));
  assert.notDeepEqual(queryKeys.activityList('a', empty), queryKeys.activityList('a', { ...empty, sport: 'gym' }));
});
