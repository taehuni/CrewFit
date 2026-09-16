import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_SPORTS, hasDistance, initialActivitySport } from './sports.js';
import { activityPayload, activityFormValues, saveActivity } from './record.js';
import { updateActivity } from './activityMutations.js';

const base = { date: '2026-09-15', minutes: '30', seconds: '5', distance: '5.2', lapCount: '', note: '메모', sets: [] };
test('all six sports are accepted; unsupported route input falls back to running', () => {
  for (const sport of ACTIVITY_SPORTS) assert.equal(initialActivitySport(sport), sport);
  assert.equal(initialActivitySport('bad'), 'running');
  assert.ok(activityPayload({ ...base, sport: 'bad' }).errors.sport);
});
test('walking and cycling use km, swimming uses whole metres, other has no distance or laps', () => {
  for (const sport of ['walking', 'cycling']) {
    const p = activityPayload({ ...base, sport });
    assert.deepEqual(p.errors, {}); assert.equal(p.activity.distance_m, 5200);
    assert.ok(activityPayload({ ...base, sport, distance: '' }).errors.distance);
  }
  const swim = activityPayload({ ...base, sport: 'swimming', distance: '1000', lapCount: '20' });
  assert.deepEqual(swim.errors, {}); assert.equal(swim.activity.distance_m, 1000);
  assert.deepEqual(swim.activity.details, { lap_count: 20 });
  const other = activityPayload({ ...base, sport: 'other', distance: 'bad', lapCount: 'bad' });
  assert.deepEqual(other.errors, {}); assert.equal(other.activity.distance_m, null);
  assert.equal(other.activity.details, undefined);
});
test('swim laps are optional; zero is preserved; fractions, negative, overflow are rejected', () => {
  for (const value of ['', '0', '10000']) {
    const p = activityPayload({ ...base, sport: 'swimming', distance: '0', lapCount: value });
    assert.deepEqual(p.errors, {});
    assert.equal(p.activity.details.lap_count, value === '' ? undefined : Number(value));
  }
  for (const lapCount of ['-1', '1.5', '10001', 'Infinity']) assert.ok(activityPayload({ ...base, sport: 'swimming', lapCount }).errors.lapCount);
  for (const distance of ['0.5', '-1', '2147483648', 'Infinity']) assert.ok(activityPayload({ ...base, sport: 'swimming', distance }).errors.distance);
  assert.ok(activityPayload({ ...base, sport: 'cycling', distance: '1.0001' }).errors.distance);
});
test('editing preserves seconds, null distance and unrelated details; clearing laps only removes its key', () => {
  const detail = { activity: { sport: 'swimming', performed_on: '2026-09-15', duration_sec: 1805, distance_m: 1000, details: { lap_count: 20, pool_length: 50 } }, sets: [] };
  const form = activityFormValues(detail);
  assert.equal(form.distance, '1000'); assert.equal(form.lapCount, '20');
  const unchanged = activityPayload(form, { editing: true });
  assert.deepEqual(unchanged.errors, {}); assert.equal(unchanged.activity.duration_sec, 1805);
  assert.equal(unchanged.activity.details, undefined);
  assert.deepEqual(activityPayload({ ...form, lapCount: '30' }, { editing: true }).activity.details, { lap_count: 30, pool_length: 50 });
  assert.deepEqual(activityPayload({ ...form, lapCount: '' }, { editing: true }).activity.details, { pool_length: 50 });
  assert.deepEqual(detail.activity.details, { lap_count: 20, pool_length: 50 });
  for (const sport of ['walking', 'cycling', 'swimming', 'other']) {
    const values = activityFormValues({ activity: { ...detail.activity, sport, distance_m: null }, sets: [] });
    const p = activityPayload(values, { editing: true });
    assert.deepEqual(p.errors, {}); assert.equal(p.activity.distance_m, null);
  }
});
test('four added sports save through one own-user activities insert, never a gym RPC', async () => {
  for (const sport of ['walking', 'cycling', 'swimming', 'other']) {
    let inserted;
    const db = { from(table) { assert.equal(table, 'activities'); return { insert: async row => { inserted = row; return {}; } }; } };
    await saveActivity(db, 'owner', activityPayload({ ...base, sport, distance: '1000', lapCount: '20' }));
    assert.equal(inserted.user_id, 'owner'); assert.equal(inserted.sport, sport);
    if (sport === 'swimming') assert.equal(inserted.details.lap_count, 20);
  }
});
test('updates filter immutable sport and owner; unrelated fields and routes are never overwritten', async () => {
  for (const sport of ['walking', 'cycling', 'swimming', 'other']) {
    let update; const filters = [];
    const q = { eq: (...arg) => { filters.push(arg); return q; }, select: () => q, maybeSingle: async () => ({ data: { id: 1 } }) };
    const db = { from(table) { assert.equal(table, 'activities'); return { update: body => { update = body; return q; } }; } };
    await updateActivity(db, 'owner', '1', { activity: { sport, performed_on: base.date, duration_sec: 1805, distance_m: 1000, note: 'edit', details: { lap_count: 20 }, user_id: 'other', started_at: 'bad' }, sets: [] });
    assert.ok(filters.some(([key, value]) => key === 'sport' && value === sport));
    assert.ok(filters.some(([key, value]) => key === 'user_id' && value === 'owner'));
    assert.equal('distance_m' in update, hasDistance(sport));
    assert.equal('details' in update, sport === 'swimming');
    assert.equal('started_at' in update, false); assert.equal('user_id' in update, false);
  }
});
test('unexpected legacy details are not silently erased by lap editing', () => {
  const detail = { activity: { sport: 'swimming', performed_on: base.date, duration_sec: 1805, distance_m: 1000, details: ['legacy'] }, sets: [] };
  const form = activityFormValues(detail);
  assert.equal(activityPayload(form, { editing: true }).activity.details, undefined);
  assert.ok(activityPayload({ ...form, lapCount: '20' }, { editing: true }).errors.lapCount);
});
