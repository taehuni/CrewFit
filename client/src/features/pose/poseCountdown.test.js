import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPoseCountdown} from './poseCountdown.js';

function clock(){
 let next=0;const pending=new Map();
 return {schedule(fn,delay){assert.equal(delay,1000);pending.set(++next,fn);return next;},cancel(id){pending.delete(id);},tick(){const jobs=[...pending.values()];pending.clear();jobs.forEach(fn=>fn());},get size(){return pending.size;}};
}
test('preparation grants five full seconds before any measurement or capture can start',async()=>{
 const timer=clock(),ticks=[];let completed=false;
 const promise=waitForPoseCountdown({...timer,onTick:n=>ticks.push(n)}).then(()=>{completed=true;});
 assert.deepEqual(ticks,[5]);
 for(let second=1;second<5;second++){timer.tick();await Promise.resolve();assert.equal(completed,false);}
 assert.deepEqual(ticks,[5,4,3,2,1]);timer.tick();await promise;
 assert.equal(completed,true);assert.equal(timer.size,0);
});
test('cancel prevents delayed start and removes the pending timer',async()=>{
 const timer=clock(),job=new AbortController(),ticks=[];
 const promise=waitForPoseCountdown({...timer,signal:job.signal,onTick:n=>ticks.push(n)});
 timer.tick();job.abort();
 await assert.rejects(promise,{name:'AbortError'});
 assert.equal(timer.size,0);timer.tick();assert.deepEqual(ticks,[5,4]);
});
test('an already cancelled preparation never announces or schedules a countdown',async()=>{
 const timer=clock(),job=new AbortController();job.abort();
 await assert.rejects(waitForPoseCountdown({...timer,signal:job.signal,onTick:()=>assert.fail('cancelled')}),{name:'AbortError'});
 assert.equal(timer.size,0);
});
