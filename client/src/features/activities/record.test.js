import test from 'node:test';
import assert from 'node:assert/strict';
import { activityPayload, saveActivity } from './record.js';
const base = {sport: 'running', date: '2026-09-13', minutes: '31', distance: '5.2', note: ' test ', sets: []};
test('creation and editing use minutes plus seconds without losing precision', () => {
  for (const editing of [false, true]) {
    const result = activityPayload({ ...base, minutes: '0', seconds: '45' }, { editing });
    assert.deepEqual(result.errors, {});
    assert.equal(result.activity.duration_sec, 45);
    assert.equal(activityPayload({ ...base, seconds: '15' }, { editing }).activity.duration_sec, 1875);
    for (const seconds of ['', '-1', '60', '1.5', 'Infinity']) {
      assert.ok(activityPayload({ ...base, seconds }, { editing }).errors.seconds);
    }
    assert.ok(activityPayload({ ...base, minutes: '35791394', seconds: '8' }, { editing }).errors.minutes);
    assert.deepEqual(activityPayload({ ...base, minutes: '35791394', seconds: '7' }, { editing }).errors, {});
  }
  assert.ok(activityPayload({ ...base, minutes: '0', seconds: '0' }).errors.minutes);
  assert.deepEqual(activityPayload({ ...base, minutes: '0', seconds: '0' }, { editing: true }).errors, {});
});
test('running payload converts units and trims note', () => {
  const result = activityPayload(base);
  assert.deepEqual(result.errors, {});
  assert.equal(result.activity.duration_sec, 1860);
  assert.equal(result.activity.distance_m, 5200);
  assert.equal(result.activity.note, 'test');
});
test('blank, fractional minutes, invalid date and oversized numeric values are rejected', () => {
  for (const change of [{minutes: ''}, {minutes: '1.5'}, {minutes:'35791395'}, {distance: ''}, {distance:'Infinity'}, {distance:'-1'}, {date:'2026-02-30'}]) {
    assert.ok(Object.keys(activityPayload({...base, ...change}).errors).length);
  }
});
test('gym validates sets and numbers each exercise case-insensitively', () => {
  const result = activityPayload({...base, sport: 'gym', sets: [
    {name:' Squat ', reps:'10', weight:'0'}, {name:'squat', reps:'12', weight:'20.5'},
    {name:'Bench', reps:'8', weight:'40'},
  ]});
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.sets.map(s => s.set_no), [1, 2, 1]);
  assert.equal(result.sets[0].exercise_name, 'Squat');
  assert.equal(result.activity.distance_m, null);
  for (const sets of [[], [{name:'',reps:'',weight:''}], [{name:'a',reps:'1.5',weight:'-1'}], [{name:'a',reps:'1',weight:'1.001'}]]) {
    assert.ok(Object.keys(activityPayload({...base, sport:'gym', sets}).errors).length);
  }
});
test('running uses own-user insert; gym uses single transaction RPC; errors propagate', async () => {
  let inserted, rpc;
  const db = { from: table => { assert.equal(table, 'activities'); return {insert: async row => { inserted = row; return {}; }}; },
    rpc: async (...args) => { rpc = args; return {data:1}; } };
  await saveActivity(db, 'user-a', activityPayload(base));
  assert.equal(inserted.user_id, 'user-a');
  const gym = activityPayload({...base, sport:'gym', sets:[{name:'Squat',reps:'10',weight:'0'}]});
  await saveActivity(db, 'user-a', gym);
  assert.equal(rpc[0], 'save_gym_activity');
  assert.equal(rpc[1].p_sets.length, 1);
  await assert.rejects(saveActivity({rpc:async()=>({error:new Error('offline')})}, 'user-a', gym), /offline/);
});
