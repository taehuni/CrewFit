import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisionGate,classifiedVisionCriteria,visionCriteria} from './poseVision.js';
test('vision requests never overlap and are separated by 35 seconds',()=>{let time=0;const gate=createVisionGate(()=>time);assert.equal(gate.begin(),true);time=40000;assert.equal(gate.begin(),false);gate.end();assert.equal(gate.begin(),true);gate.end();time=74999;assert.equal(gate.begin(),false);time=75000;assert.equal(gate.begin(),true);});
test('paused automatic feedback needs explicit resumption',()=>{const gate=createVisionGate();gate.pause();assert.equal(gate.begin(),false);gate.resume();assert.equal(gate.begin(),true);});
test('classification cannot enable unknown or unreferenced exercises',()=>{assert.equal(classifiedVisionCriteria({evaluationMode:'vision',criteriaId:'invented'}),null);assert.equal(visionCriteria('sit_up'),null);assert.equal(classifiedVisionCriteria({evaluationMode:'record-only',criteriaId:'leg_press'}),null);assert.equal(classifiedVisionCriteria({evaluationMode:'vision',criteriaId:'leg_press'}).id,'leg_press');});
