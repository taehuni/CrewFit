import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWorkoutMonth,fetchPlanMonth,workoutDraft} from './workoutPlans.js';
test('month fetch follows every page beyond 100 and sorts by schedule',async()=>{
 const calls=[];const signal=new AbortController().signal;
 const rows=await fetchWorkoutMonth(async(path,options)=>{calls.push(path);assert.equal(options.signal,signal);return calls.length===1?{plans:Array.from({length:100},(_,i)=>({id:String(i),scheduled_on:'2026-11-20',start_time:'10:00'})),nextCursor:'next'}:{plans:[{id:'101',scheduled_on:'2026-11-01',start_time:'09:00'}],nextCursor:null};},'2026-11',signal);
 assert.equal(rows.length,101);assert.equal(rows[0].id,'101');assert.match(calls[1],/cursor=next/);
});
test('meal month follows pagination without requiring a workout start time',async()=>{
 const calls=[];
 const rows=await fetchPlanMonth(async path=>{calls.push(path);return calls.length===1?{plans:[{id:'a',scheduled_on:'2026-11-20',meal_type:'dinner'}],nextCursor:'a'}:{plans:[{id:'b',scheduled_on:'2026-11-01',meal_type:'lunch'}],nextCursor:null};},'2026-11',undefined,'/coach/meal-plans');
 assert.match(calls[0],/^\/coach\/meal-plans\?month=/);assert.match(calls[1],/cursor=a/);
 assert.equal(rows[0].id,'b');assert.equal(rows.length,2);
});
test('later page error does not return an incomplete month as successful',async()=>{
 let calls=0;await assert.rejects(fetchWorkoutMonth(async()=>{if(calls++)throw new Error('offline');return {plans:[],nextCursor:'next'};},'2026-11'),/offline/);
});
test('editable draft strips ownership and database time seconds',()=>{
 assert.deepEqual(workoutDraft({id:'id',user_id:'owner',title:'걷기',sport:'walking',scheduled_on:'2026-11-16',start_time:'19:30:00',minutes:30,note:''}),{title:'걷기',sport:'walking',scheduled_on:'2026-11-16',start_time:'19:30',minutes:30,note:''});
});
