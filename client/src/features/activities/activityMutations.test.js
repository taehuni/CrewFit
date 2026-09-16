import test from 'node:test';
import assert from 'node:assert/strict';
import { activityFormValues, activityPayload } from './record.js';
import { updateActivity, deleteActivity, invalidateActivityData } from './activityMutations.js';
import { queryKeys } from '../../shared/queryKeys.js';

const detail = {activity:{id:7,sport:'gym',performed_on:'2026-09-14',duration_sec:1805,distance_m:null,note:'메모'},sets:[
  {exercise_name:'Squat',reps:0,weight_kg:0},{exercise_name:'Bench',reps:null,weight_kg:null}
]};
function mutationDb(result = {data:{id:7}}) {
  const calls = [];
  const query = {eq:(...args)=>{calls.push(['eq',...args]);return query;},select:()=>query,maybeSingle:async()=>result};
  return {calls,from:table=>({update:body=>{calls.push(['update',table,body]);return query;},delete:()=>{calls.push(['delete',table]);return query;}})};
}
test('edit prefill round-trip preserves seconds, zero and missing values', () => {
  const form=activityFormValues(detail);
  assert.equal(form.seconds,'5');assert.equal(form.sets[0].weight,'0');assert.equal(form.sets[1].weight,'');
  const payload=activityPayload(form,{editing:true});
  assert.deepEqual(payload.errors,{});
  assert.equal(payload.activity.duration_sec,1805);
  assert.equal(payload.sets[0].reps,0);assert.equal(payload.sets[1].reps,null);
  assert.equal(payload.sets[0].weight_kg,0);assert.equal(payload.sets[1].weight_kg,null);
  const running=activityFormValues({activity:{...detail.activity,sport:'running',duration_sec:0},sets:[]});
  assert.deepEqual(activityPayload(running,{editing:true}).errors,{});
  assert.equal(activityPayload(running,{editing:true}).activity.distance_m,null);
});
test('edit validates seconds and total integer overflow without loosening creation', () => {
  for(const seconds of ['','-1','60','0.5']) assert.ok(activityPayload({...activityFormValues(detail),seconds},{editing:true}).errors.seconds);
  assert.ok(activityPayload({...activityFormValues(detail),minutes:'35791394',seconds:'48'},{editing:true}).errors.minutes);
  const create={sport:'running',date:'2026-09-14',minutes:'0',distance:'',note:'',sets:[]};
  assert.ok(activityPayload(create).errors.minutes);assert.ok(activityPayload(create).errors.distance);
});
test('running update uses only mutable columns and own-id/sport filters', async () => {
  const db=mutationDb();
  await updateActivity(db,'owner','7',{activity:{sport:'running',performed_on:'2026-09-13',duration_sec:2400,distance_m:5000,note:'edit',id:999,user_id:'other'},sets:[]});
  assert.deepEqual(Object.keys(db.calls[0][2]).sort(),['distance_m','duration_sec','note','performed_on']);
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]==='7'));
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='sport'&&c[2]==='running'));
});
test('gym update calls one transaction RPC; missing migration error is preserved', async () => {
  let args;
  const payload=activityPayload(activityFormValues(detail),{editing:true});
  await updateActivity({rpc:async(...values)=>{args=values;return {data:7};}},'owner','7',payload);
  assert.equal(args[0],'update_gym_activity');assert.equal(args[1].p_activity_id,'7');assert.equal(args[1].p_sets.length,2);
  await assert.rejects(updateActivity({rpc:async()=>({error:{code:'PGRST202'}})},'owner','7',payload),e=>e.code==='PGRST202');
});
test('delete is one own-record parent delete and refuses zero affected rows', async () => {
  const db=mutationDb();
  await deleteActivity(db,'owner','7');
  assert.deepEqual(db.calls,[['delete','activities'],['eq','id','7'],['eq','user_id','owner']]);
  await assert.rejects(deleteActivity(mutationDb({data:null}),'owner','7'),e=>e.code==='not_found');
  await assert.rejects(deleteActivity(mutationDb({error:new Error('offline')}),'owner','7'),/offline/);
});
test('invalid ids and update with no affected record do not report success', async () => {
  const db=mutationDb();
  await assert.rejects(deleteActivity(db,'owner','bad'),e=>e.code==='not_found');
  assert.deepEqual(db.calls,[]);
  await assert.rejects(updateActivity(mutationDb({data:null}),'owner','7',{activity:{sport:'running'}}),e=>e.code==='not_found');
});
test('refresh covers detail/list and all weeks for only the current member', async () => {
  const calls=[];
  await invalidateActivityData({invalidateQueries:async arg=>calls.push(arg)},'owner');
  assert.deepEqual(calls,[{queryKey:queryKeys.activitiesRoot('owner')},{queryKey:queryKeys.dashboardRoot('owner')}]);
});
