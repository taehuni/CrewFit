import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPoseCamera,attachPoseCamera,watchPoseCameraVisibility,poseCameraError} from './poseCamera.js';

test('camera requests no microphone and relaxes only unsupported image constraints',async()=>{
 const calls=[],stream={};
 const mediaDevices={getUserMedia:async options=>{calls.push(options);if(calls.length===1)throw {name:'OverconstrainedError'};return stream;}};
 assert.equal(await requestPoseCamera({mediaDevices,secure:true,facing:'environment'}),stream);
 assert.equal(calls.length,2);assert(calls.every(call=>call.audio===false));
 assert.deepEqual(calls[1].video,{facingMode:{ideal:'environment'}});
});
test('denied permission never produces a second camera prompt',async()=>{
 let calls=0;
 await assert.rejects(requestPoseCamera({secure:true,mediaDevices:{getUserMedia:async()=>{calls++;throw {name:'NotAllowedError'};}}}),{name:'NotAllowedError'});
 assert.equal(calls,1);
});
test('insecure or unsupported camera fails before requesting permission',async()=>{
 let calls=0;
 await assert.rejects(requestPoseCamera({secure:false,mediaDevices:{getUserMedia:()=>calls++}}),{code:'camera_unavailable'});
 assert.equal(calls,0);
});
test('permission sheet hiding does not cancel preparation; established camera stops when hidden',()=>{
 const page=new EventTarget();page.hidden=true;
 let session={previewReady:false},stops=0;
 const remove=watchPoseCameraVisibility({document:page,getSession:()=>session,onHidden:()=>stops++});
 page.dispatchEvent(new Event('visibilitychange'));assert.equal(stops,0);
 session.previewReady=true;page.dispatchEvent(new Event('visibilitychange'));assert.equal(stops,1);
 page.hidden=false;page.dispatchEvent(new Event('visibilitychange'));assert.equal(stops,1);
 remove();page.hidden=true;page.dispatchEvent(new Event('visibilitychange'));assert.equal(stops,1);
});
test('late permission result releases stream without replacing a newer preview',async()=>{
 let stopped=0;const previous={};const video={srcObject:previous};
 const stream={getTracks:()=>[{stop:()=>stopped++}]};
 assert.equal(await attachPoseCamera(stream,video,{isCurrent:()=>false,isHidden:()=>false}),false);
 assert.equal(stopped,1);assert.equal(video.srcObject,previous);
});
test('preview stays inline and muted; a hidden page cannot start it',async()=>{
 const stream={};let played=0;const video={play:async()=>played++};
 await assert.rejects(attachPoseCamera(stream,video,{isCurrent:()=>true,isHidden:()=>true}),{code:'camera_hidden'});
 assert.equal(played,0);
 assert.equal(await attachPoseCamera(stream,video,{isCurrent:()=>true,isHidden:()=>false}),true);
 assert.equal(played,1);assert.equal(video.srcObject,stream);assert(video.muted&&video.playsInline&&video.autoplay);
});
test('a preview canceled during playback cannot become ready',async()=>{
 let current=true,stopped=0;const stream={getTracks:()=>[{stop:()=>stopped++}]};
 const video={play:async()=>{current=false;}};
 assert.equal(await attachPoseCamera(stream,video,{isCurrent:()=>current,isHidden:()=>false}),false);
 assert.equal(stopped,1);
});
test('camera errors distinguish permission, missing camera, occupied camera and hidden page',()=>{
 assert.match(poseCameraError({name:'NotAllowedError'}),/권한/);
 assert.match(poseCameraError({name:'NotFoundError'}),/찾지/);
 assert.match(poseCameraError({name:'NotReadableError'}),/다른 앱/);
 assert.match(poseCameraError({code:'camera_hidden'}),/화면/);
});
