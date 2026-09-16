import test from 'node:test';
import assert from 'node:assert/strict';
import { loadActivityDetail, validActivityId, groupExerciseSets, detailDuration } from './activityDetail.js';
import { queryKeys } from '../../shared/queryKeys.js';

const activity = {id: 7, user_id: 'owner', sport: 'gym', performed_on: '2026-09-14', duration_sec: 1800, distance_m: null, note: '메모'};
function mockDb({record = activity, sets = [], cap = 2, fail = null} = {}) {
  const calls = [];
  return {calls, from(table) {
    const filters = [];
    calls.push({table, filters});
    let cursor = 0;
    const q = {
      select: () => q, eq: (key, value) => { filters.push([key,value]); return q; },
      order: () => q, limit: () => q, gt: (key,value) => { assert.equal(key,'id'); cursor=value; return q; },
      maybeSingle: async () => fail === 'activities' ? {error:new Error('parent failed')}
        : {data:record && filters.every(([key,value])=>String(record[key])===String(value)) ? record : null},
      then(resolve,reject) {
        const result = fail === 'exercise_sets' ? {error:new Error('sets failed')} : {data:sets
          .filter(row=>row.id>cursor && filters.every(([key,value])=>String(row[key])===String(value)))
          .sort((a,b)=>a.id-b.id).slice(0,cap)};
        return Promise.resolve(result).then(resolve,reject);
      },
    };
    return q;
  }};
}
test('invalid identifiers do not query the database', async () => {
  const db=mockDb();
  for(const id of ['', '0','-1','1.5','1 OR 1=1','9223372036854775808',undefined]) {
    assert.equal(validActivityId(id),false);
    assert.equal(await loadActivityDetail(db,'owner',id),null);
  }
  assert.equal(validActivityId('9223372036854775807'),true);
  assert.equal(db.calls.length,0);
});
test('missing and another member records have identical not-found results', async () => {
  for(const db of [mockDb({record:null}),mockDb()]){
    assert.equal(await loadActivityDetail(db,'other','7'),null);
    assert.equal(db.calls.length,1);
  }
});
test('running detail does not query gym sets and preserves zero distance', async () => {
  const db=mockDb({record:{...activity,sport:'running',distance_m:0}});
  const data=await loadActivityDetail(db,'owner','7');
  assert.equal(data.activity.distance_m,0);
  assert.deepEqual(data.sets,[]);
  assert.equal(db.calls.length,1);
});
test('gym detail pages through all sets and filters every page by owner and activity', async () => {
  const sets=Array.from({length:503},(_,i)=>({id:i+1,user_id:'owner',activity_id:7,exercise_name:'Squat',set_no:i+1,reps:10,weight_kg:0}));
  sets.push({id:504,user_id:'other',activity_id:7,exercise_name:'hidden'}, {id:505,user_id:'owner',activity_id:8,exercise_name:'different activity'});
  const db=mockDb({sets,cap:127});
  const result=await loadActivityDetail(db,'owner','7');
  assert.equal(result.sets.length,503);
  assert.ok(db.calls.every(call=>call.filters.some(([key,value])=>key==='user_id'&&value==='owner')));
  assert.ok(db.calls.filter(call=>call.table==='exercise_sets').every(call=>call.filters.some(([key,value])=>key==='activity_id'&&value==='7')));
});
test('database failures reject instead of returning an empty record or empty sets', async () => {
  for(const fail of ['activities','exercise_sets']) await assert.rejects(loadActivityDetail(mockDb({fail}),'owner','7'),/failed/);
  assert.deepEqual((await loadActivityDetail(mockDb(),'owner','7')).sets,[]);
});
test('exercise grouping is case-insensitive, sorts set numbers, and retains null vs zero', () => {
  const rows=[{exercise_name:' Squat ',set_no:2,reps:null,weight_kg:null},{exercise_name:'squat',set_no:1,reps:0,weight_kg:0},{exercise_name:'Bench',set_no:1,reps:10,weight_kg:30}];
  const groups=groupExerciseSets(rows);
  assert.equal(groups.length,2);
  assert.equal(groups[0].name,'Squat');
  assert.deepEqual(groups[0].sets.map(s=>s.set_no),[1,2]);
  assert.equal(groups[0].sets[0].weight_kg,0);
  assert.equal(groups[0].sets[1].weight_kg,null);
  assert.equal(rows[0].set_no,2);
});
test('duration keeps seconds and detail cache is scoped to user and record', () => {
  assert.equal(detailDuration(0),'0분');
  assert.equal(detailDuration(1800),'30분');
  assert.equal(detailDuration(5405),'1시간 30분 5초');
  assert.notDeepEqual(queryKeys.activity('a','7'),queryKeys.activity('b','7'));
  assert.notDeepEqual(queryKeys.activity('a','7'),queryKeys.activity('a','8'));
  assert.deepEqual(queryKeys.activity('a','7').slice(0,2),queryKeys.activitiesRoot('a'));
});
