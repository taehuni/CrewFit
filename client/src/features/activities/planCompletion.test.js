import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceWorkoutPlanId,recordWorkoutPlan} from './planCompletion.js';
const id='12345678-1234-4234-8234-123456789abc';
test('plan source must have matching owner and a valid ID',()=>{
 assert.equal(sourceWorkoutPlanId({planOwnerId:'a',workoutPlan:{id}},'a'),id);
 assert.equal(sourceWorkoutPlanId({planOwnerId:'a',workoutPlan:{id}},'b'),null);
 assert.equal(sourceWorkoutPlanId({planOwnerId:'a',workoutPlan:{id:'bad'}},'a'),null);
});
test('GPS imports finalize and link the plan in a single RPC',async()=>{
 const payload={activity:{note:'걷기'},sets:[]};
 const db={rpc:async(name,args)=>{assert.equal(name,'record_workout_plan_gps');assert.deepEqual(args,{p_plan_id:id,p_draft_id:'draft',p_note:'걷기'});return {data:43};}};
 assert.equal(await recordWorkoutPlan(db,id,payload,'draft'),43);
});
test('plan recording uses one atomic RPC and propagates failure without an ordinary insert fallback',async()=>{
 const payload={activity:{sport:'walking'},sets:[]};
 const db={rpc:async(name,args)=>{assert.equal(name,'record_workout_plan');assert.deepEqual(args,{p_plan_id:id,p_activity:payload.activity,p_sets:[]});return {data:42};}};
 assert.equal(await recordWorkoutPlan(db,id,payload),42);
 await assert.rejects(recordWorkoutPlan({rpc:async()=>({error:{code:'PGRST202'}})},id,payload),/입력한 내용은 유지/);
});
