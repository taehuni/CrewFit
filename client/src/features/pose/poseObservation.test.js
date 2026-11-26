import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPoseObservation,validatePoseObservation} from './poseObservation.js';
import {createVisionRecovery} from './poseVision.js';

test('an empty or malformed successful HTTP reply stops observation instead of staying in analysis',()=>{
 for(const response of [null,undefined,{}, {exercise:'leg_press',observations:[]},{exercise:'squat',matched:true,observations:[]}]){
  assert.throws(()=>validatePoseObservation(response,'leg_press'),error=>{
   assert.equal(error.code,'analysis_invalid_response');
   assert.equal(createVisionRecovery().failed(error).retry,false);return true;
  });
 }
 const unmatched={exercise:'leg_press',matched:false,observations:[]};assert.equal(validatePoseObservation(unmatched,'leg_press'),unmatched);
});
test('capture finishing after an auth refresh uses latest token and clears frames',async()=>{
 let token='before',finish;const frames=['mock-frame'];const pending=requestPoseObservation({capture:()=>new Promise(resolve=>{finish=()=>resolve(frames);}),request:async options=>{assert.equal(options.token,'after');assert.equal(options.body.exercise,'leg_press');return {matched:true};},getToken:()=>token,exercise:'leg_press',signal:new AbortController().signal,isCurrent:()=>true});
 token='after';finish();assert.equal((await pending).matched,true);assert.equal(frames.length,0);
});
test('cancel or account/camera change during capture never sends frames',async()=>{
 for(const cancel of [false,true]){const controller=new AbortController(),frames=['mock'];let finish,current=true,calls=0;const pending=requestPoseObservation({capture:()=>new Promise(resolve=>{finish=()=>resolve(frames);}),request:async()=>calls++,getToken:()=>'',exercise:'leg_press',signal:controller.signal,isCurrent:()=>current});if(cancel)controller.abort();else current=false;finish();assert.equal(await pending,null);assert.equal(calls,0);assert.equal(frames.length,0);}
});
