import test from 'node:test';
import assert from 'node:assert/strict';
import { recordSource } from './recordSource.js';

test('record source uses route presence for old and new GPS records, not start time', () => {
  assert.equal(recordSource({activity_routes: {activity_id: 1}}), 'GPS 측정');
  assert.equal(recordSource({activity_routes: [{activity_id: 2}]}), 'GPS 측정');
  assert.equal(recordSource({started_at: '2026-10-03T00:00:00Z', activity_routes: null}), '직접 입력');
  assert.equal(recordSource({activity_routes: []}), '직접 입력');
});
