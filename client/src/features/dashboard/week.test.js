import test from 'node:test';
import assert from 'node:assert/strict';
import { kstToday, weekDates, weekLabel } from './week.js';

test('KST date advances at 15:00 UTC regardless of browser timezone', () => {
  assert.equal(kstToday(new Date('2026-09-13T14:59:59Z')), '2026-09-13');
  assert.equal(kstToday(new Date('2026-09-13T15:00:00Z')), '2026-09-14');
});
test('Sunday belongs to the preceding Monday, with previous week navigation', () => {
  assert.deepEqual(weekDates('2026-09-13'), ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
  assert.equal(weekDates('2026-09-13', -1)[0], '2026-08-31');
});
test('week crosses years and leap days correctly', () => {
  assert.equal(weekDates('2027-01-01')[0], '2026-12-28');
  assert.ok(weekDates('2028-03-01').includes('2028-02-29'));
});
test('week label keeps the year, including both years at a year boundary', () => {
  assert.equal(weekLabel(weekDates('2026-09-13')), '2026.09.07 — 09.13');
  assert.equal(weekLabel(weekDates('2027-01-01')), '2026.12.28 — 2027.01.03');
});
