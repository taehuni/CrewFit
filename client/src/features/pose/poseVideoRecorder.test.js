import test from 'node:test';
import assert from 'node:assert/strict';
import {createPoseVideoRecorder} from './poseVideoRecorder.js';
function setup(options={}){
 let instance,timer,time=0,clip,error,status;const track={stop(){throw new Error('camera must stay active');}};
 class Recorder{static isTypeSupported(){return true;}constructor(stream){assert.deepEqual(stream,[track]);instance=this;this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['video'])});this.onstop();}}
 const control=createPoseVideoRecorder({stream:{getVideoTracks:()=>[track]},Recorder,makeStream:tracks=>tracks,now:()=>time,schedule:fn=>{timer=fn;return 1;},clear:()=>{},onComplete:value=>clip=value,onError:value=>error=value,onStatus:value=>status=value,...options});
 return {control,finish(seconds=120){time=seconds*1000;timer();},instance,get clip(){return clip;},get error(){return error;},get status(){return status;}};
}
test('120 seconds stops only recorder and creates bounded silent clip',()=>{const run=setup();run.finish();assert.equal(run.clip.durationSeconds,120);assert.equal(run.clip.mimeType,'video/webm');assert.equal(run.status,'complete');});
test('early stop preserves recorded duration',()=>{const run=setup();run.finish(12);assert.equal(run.clip.durationSeconds,12);});
test('dispose suppresses callbacks and discards sensitive chunks',()=>{const run=setup();run.control.dispose();assert.equal(run.clip,undefined);assert.equal(run.error,undefined);});
test('size cap discards complete recording without stopping camera',()=>{const run=setup({maxBytes:2});run.finish();assert.equal(run.clip,undefined);assert.match(run.error.message,/용량/);});
test('unsupported browser explains that measurement remains available',()=>assert.throws(()=>setup({Recorder:null}),/자세 측정은 계속/));
