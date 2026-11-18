import test from 'node:test';
import assert from 'node:assert/strict';
import {coachWorkspace,listWorkoutPlans,planMonthRange,updateWorkoutPlan,createWorkoutPlan,listMealPlans} from './workoutPlans.js';
const id='12345678-1234-4234-8234-123456789abc';
const valid={title:' 저녁 걷기 ',sport:'walking',scheduled_on:'2026-11-16',start_time:'19:30',minutes:30,note:'가볍게 걷기'};
function mock(data,error=null){const calls=[];const chain={then(resolve){return Promise.resolve({data,error}).then(resolve);}};for(const method of ['select','eq','gte','lte','order','limit','gt','update','maybeSingle','in','upsert','single'])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};return {db:{from(table){calls.push(['from',table]);return chain;}},calls};}
test('workspace includes older selected conversation after refetch without a 100-plan cutoff',async()=>{
 const recent=mock([{id:'recent'}]),saved=mock(Array.from({length:110},(_,i)=>({id:i})));
 const db={from:table=>(table==='coach_turns'?recent:saved).db.from(table)};
 const workspace=await coachWorkspace(db,'owner',{turn_id:id});
 assert.equal(workspace.plans.length,110);
 assert.deepEqual(saved.calls.find(c=>c[0]==='in'),['in','turn_id',['recent',id]]);
 assert.ok(saved.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));
 assert.deepEqual(saved.calls.find(c=>c[0]==='limit'),['limit',868]);
 await assert.rejects(coachWorkspace(db,'owner',{turn_id:'bad'}),{status:400});
});
test('manual plan keeps owner, retry ID and no fabricated AI source',async()=>{
 const {db,calls}=mock({...valid,id});
 await createWorkoutPlan(db,'owner',{...valid,id,user_id:'someone',turn_id:id});
 assert.deepEqual(calls.find(c=>c[0]==='upsert')[1],{...valid,title:'저녁 걷기',id,user_id:'owner',turn_id:null,position:null});
 await assert.rejects(createWorkoutPlan(db,'owner',{...valid,id:'bad'}),{status:400});
 await assert.rejects(createWorkoutPlan(mock(null,{code:'23502'}).db,'owner',{...valid,id}),{status:503});
});
test('manual retry returns an identical saved plan and rejects edited retry payloads',async()=>{
 const existing={...valid,title:'저녁 걷기',start_time:'19:30:00',id};
 function retryDb(){let requests=0;return {from:table=>(requests++===0?mock(null):mock(existing)).db.from(table)};}
 assert.deepEqual(await createWorkoutPlan(retryDb(),'owner',{...valid,id}),existing);
 await assert.rejects(createWorkoutPlan(retryDb(),'owner',{...valid,id,title:'바뀐 이름'}),{status:409});
});
test('meal plans paginate within owner and requested month',async()=>{
 const {db,calls}=mock(Array.from({length:101},(_,i)=>({id:String(i)})));
 const page=await listMealPlans(db,'owner',{month:'2028-02',cursor:id});
 assert.equal(page.plans.length,100);assert.equal(page.nextCursor,'99');
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));
 assert.ok(calls.some(c=>c[0]==='lte'&&c[2]==='2028-02-29'));
 assert.ok(calls.some(c=>c[0]==='gt'&&c[2]===id));
});
test('completion joins only this owner and reports missing relation honestly',async()=>{
 const plans=mock([{id}]),links=mock([{plan_id:id,activity_id:42}]);
 const db={from:table=>(table==='workout_plans'?plans:links).db.from(table)};
 assert.equal((await listWorkoutPlans(db,'owner',{month:'2026-11'})).plans[0].activity_id,42);
 assert.ok(links.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));
 const failed=mock(null,{code:'42P01'});
 const degraded=await listWorkoutPlans({from:table=>(table==='workout_plans'?plans:failed).db.from(table)},'owner',{month:'2026-11'});
 assert.equal(degraded.plans[0].completion_available,false);
});
test('month range validates input and leap-year end',()=>{
 assert.deepEqual(planMonthRange('2028-02'),{from:'2028-02-01',to:'2028-02-29'});
 for(const value of ['2026-13','1999-12','2101-01','2026-1',[],null])assert.throws(()=>planMonthRange(value),{status:400});
});
test('month fetch is user scoped, bounded and offers continuation past 100 rows',async()=>{
 const rows=Array.from({length:101},(_,i)=>({id:String(i)}));const {db,calls}=mock(rows);
 const page=await listWorkoutPlans(db,'owner',{month:'2026-11',cursor:id});
 assert.equal(page.plans.length,100);assert.equal(page.nextCursor,'99');
 for(const call of [['eq','user_id','owner'],['gte','scheduled_on','2026-11-01'],['lte','scheduled_on','2026-11-30'],['gt','id',id],['limit',101]])assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(call)));
 assert.equal((await listWorkoutPlans(mock([]).db,'owner',{month:'2026-11'})).nextCursor,null);
 await assert.rejects(listWorkoutPlans(db,'owner',{month:'2026-11',cursor:'bad'}),{status:400});
});
test('update keeps authenticated ownership and accepts only editable fields',async()=>{
 const {db,calls}=mock({...valid,id});await updateWorkoutPlan(db,'owner',id,{...valid,user_id:'attacker',turn_id:'other',position:99});
 assert.deepEqual(calls.find(c=>c[0]==='update')[1],{...valid,title:'저녁 걷기'});
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]===id));
});
test('missing/foreign plan, invalid input and unavailable permissions fail explicitly',async()=>{
 await assert.rejects(updateWorkoutPlan(mock(null).db,'owner',id,valid),{status:404});
 await assert.rejects(updateWorkoutPlan(mock(null,{code:'42501'}).db,'owner',id,valid),{status:503});
 for(const patch of [{scheduled_on:'2026-02-30'},{start_time:'24:00'},{minutes:4},{title:'  '},{sport:'invalid'}])await assert.rejects(updateWorkoutPlan(mock({}).db,'owner',id,{...valid,...patch}),{status:400});
 await assert.rejects(updateWorkoutPlan(mock({}).db,'owner','bad',valid),{status:400});
});
