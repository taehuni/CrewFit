import test from 'node:test';
import assert from 'node:assert/strict';
import {isStartPoseFrameFresh} from './startPoseFreshness.js';

test('stalled frames expire even when no new recognition result arrives',()=>{
 const capturedAt=1200;
 assert.equal(isStartPoseFrameFresh(capturedAt,1320),true);
 assert.equal(isStartPoseFrameFresh(capturedAt,1700),true);
 assert.equal(isStartPoseFrameFresh(capturedAt,1701),false);
 assert.equal(isStartPoseFrameFresh(capturedAt,10000),false);
});
test('reset/no frame and invalid clocks cannot authorize a start',()=>{
 for(const timestamp of [null,undefined,NaN,Infinity])assert.equal(isStartPoseFrameFresh(timestamp,1000),false);
 assert.equal(isStartPoseFrameFresh(1000,999),false);
 assert.equal(isStartPoseFrameFresh(1000,NaN),false);
 assert.equal(isStartPoseFrameFresh(1000,Infinity),false);
});
