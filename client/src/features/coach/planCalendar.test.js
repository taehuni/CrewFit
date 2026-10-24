import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthDays, moveMonth} from './planCalendar.js';
test('달력은 월요일부터 시작하고 윤년 및 6주인 달을 표시한다', () => {
  assert.equal(monthDays('2026-06')[0], '2026-06-01');
  assert.equal(monthDays('2024-02').filter(Boolean).length, 29);
  assert.equal(monthDays('2026-03').length, 42);
  assert.equal(monthDays('2026-03')[6], '2026-03-01');
});
test('월 이동은 연도 경계를 처리한다', () => {
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(moveMonth('2026-01', -1), '2025-12');
});
