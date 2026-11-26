import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisionGate,createVisionRecovery,classifiedVisionCriteria,visionCriteria,retryableVisionError} from './poseVision.js';
test('requests wait 35 seconds after completion, including varying capture latency',()=>{let time=0;const gate=createVisionGate(()=>time);assert.equal(gate.begin(),true);time=3500;const firstArrival=time;assert.equal(gate.begin(),false);gate.end();time=35000;assert.equal(gate.begin(),false);time=38500;assert.equal(gate.begin(),true);time+=2900;assert.ok(time-firstArrival>=35000);gate.end();assert.equal(gate.remaining(),35000);});
test('temporary failures retry but permanent errors and unknown 502s do not',()=>{
 for(const error of [{status:429,code:'rate_limited'},{status:502,code:'analysis_temporary_failure'},{name:'AbortError'},{name:'TypeError'}])assert.equal(retryableVisionError(error),true);
 for(const error of [{status:429,code:'daily_limit'},{status:403,code:'consent_required'},{status:503,code:'analysis_unavailable'},{status:502,code:'analysis_invalid_response'},{status:502},{status:401}])assert.equal(retryableVisionError(error),false);
});
test('repeated transient failures stop after two automatic retries until explicit retry or success',()=>{
 const recovery=createVisionRecovery(),error={code:'analysis_temporary_failure'};
 assert.deepEqual(recovery.failed(error),{retry:true,failures:1});
 assert.deepEqual(recovery.failed(error),{retry:true,failures:2});
 assert.deepEqual(recovery.failed(error),{retry:false,failures:3});
 assert.equal(recovery.failed(error).retry,false);
 recovery.reset();assert.deepEqual(recovery.failed(error),{retry:true,failures:1});
 recovery.reset();assert.equal(recovery.failed({status:502,code:'analysis_invalid_response'}).retry,false);
});
test('paused automatic feedback needs explicit resumption',()=>{const gate=createVisionGate();gate.pause();assert.equal(gate.begin(),false);gate.resume();assert.equal(gate.begin(),true);});
test('classification cannot enable unknown or unreferenced exercises',()=>{assert.equal(classifiedVisionCriteria({evaluationMode:'vision',criteriaId:'invented'}),null);assert.equal(visionCriteria('sit_up'),null);assert.equal(classifiedVisionCriteria({evaluationMode:'record-only',criteriaId:'leg_press'}),null);assert.equal(classifiedVisionCriteria({evaluationMode:'vision',criteriaId:'leg_press'}).id,'leg_press');});
