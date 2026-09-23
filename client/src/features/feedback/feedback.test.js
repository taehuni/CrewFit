import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackError, feedbackPeriodLabel, feedbackPeriodStart, loadSavedFeedback, loadFeedbackHistory, kstToday } from './feedback.js';

test('KST today and period labels cross week, month and year boundaries', () => {
  assert.equal(kstToday(new Date('2026-09-17T15:01:00Z')), '2026-09-18');
  assert.equal(feedbackPeriodLabel('day', '2026-09-18'), '9월 18일');
  assert.equal(feedbackPeriodLabel('week', '2026-01-01'), '12월 29일 — 1월 4일');
  assert.equal(feedbackPeriodLabel('month', '2026-09-18'), '2026년 9월');
});

test('known feedback failures become actionable Korean messages', () => {
  assert.match(feedbackError({ code: 'NO_DATA' }), /기록/);
  assert.match(feedbackError({ code: 'CONFIG_REQUIRED' }), /서버 환경 설정/);
  assert.match(feedbackError({ code: 'REGEN_LIMIT' }), /모두 사용/);
  assert.equal(feedbackError({ message: '직접 메시지' }), '직접 메시지');
});

test('saved feedback uses canonical period and owner filters without generation', async () => {
  assert.equal(feedbackPeriodStart('week', '2026-01-01'), '2025-12-29');
  assert.equal(feedbackPeriodStart('month', '2024-02-29'), '2024-02-01');
  assert.equal(feedbackPeriodStart('day', '2026-09-21'), '2026-09-21');
  const calls = [];
  let data = null, error = null;
  const db = { from(table) { calls.push(table); return this; }, select() { return this; },
    eq(...args) { calls.push(args); return this; }, maybeSingle: async () => ({ data, error }) };
  assert.equal(await loadSavedFeedback(db, 'owner', 'week', '2026-09-20'), null);
  assert.deepEqual(calls, ['ai_feedbacks', ['user_id', 'owner'], ['period', 'week'], ['period_start', '2026-09-14']]);
  data = { content: '기존', regen_count: 1 };
  assert.deepEqual(await loadSavedFeedback(db, 'owner', 'week', '2026-09-20'), { ...data, cached: true, remaining_regenerations: 2 });
  error = new Error('조회 실패');
  await assert.rejects(loadSavedFeedback(db, 'owner', 'week', '2026-09-20'), /조회 실패/);
});

test('history queries only the owner and paginates even with a small server row cap', async () => {
  const calls = [];
  let data = [{ id: 9, content: 'new' }, { id: 8, content: 'old' }], error = null;
  const query = { select() { return this; }, eq(...a) { calls.push(a); return this; },
    order(...a) { calls.push(a); return this; }, limit(n) { calls.push(n); return this; },
    lt(...a) { calls.push(a); return this; }, then(resolve) { return Promise.resolve({ data, error }).then(resolve); } };
  const db = { from(name) { assert.equal(name, 'ai_feedback_history'); return query; } };
  assert.deepEqual(await loadFeedbackHistory(db, 'owner', 10), { rows: data, nextCursor: 8 });
  assert.deepEqual(calls, [['user_id','owner'], ['id',{ ascending:false }], 20, ['id',10]]);
  data = [];
  assert.equal((await loadFeedbackHistory(db, 'owner', 8)).nextCursor, undefined);
  error = new Error('failed');
  await assert.rejects(loadFeedbackHistory(db, 'owner'), /failed/);
});
