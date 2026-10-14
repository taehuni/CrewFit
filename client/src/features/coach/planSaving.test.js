import test from 'node:test';
import assert from 'node:assert/strict';
import {persistWorkoutPlans} from './planSaving.js';
test('plan saving returns confirmed rows without fetching history or Calendar',async()=>{
 let calls=0;
 const rows=[{id:'plan',turn_id:'turn',position:0}];
 assert.equal(await persistWorkoutPlans(async options=>{calls++;assert.deepEqual(options.body,{turn_id:'turn',items:[{position:0}]});return rows;},'turn',[{position:0}]),rows);
 assert.equal(calls,1);
});
test('plan saving rejects incomplete confirmation and preserves server errors',async()=>{
 await assert.rejects(persistWorkoutPlans(async()=>[],'turn',[{position:0}]),/저장 결과/);
 await assert.rejects(persistWorkoutPlans(async()=>{throw new Error('권한 없음');},'turn',[{position:0}]),/권한 없음/);
});
test('unresponsive save is aborted and gives retry guidance',async()=>{
 await assert.rejects(persistWorkoutPlans(({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))),'turn',[{position:0}],10),/중복 저장되지/);
});
