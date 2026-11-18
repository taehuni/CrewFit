import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSize,validateCapturedFrame,capturePoseFrames,supportedAiSelection,waitForCapture,AI_FRAME_LIMIT} from './poseAiCapture.js';

test('capture dimensions preserve portrait/landscape ratio and never upscale',()=>{
 assert.deepEqual(captureSize(1920,1080),{width:512,height:288});
 assert.deepEqual(captureSize(480,640),{width:384,height:512});
 assert.deepEqual(captureSize(120,80),{width:120,height:80});
 assert.throws(()=>captureSize(0,0));
});
test('rejects oversized and non-JPEG payloads',()=>{
 assert.equal(validateCapturedFrame('data:image/jpeg;base64,YQ=='),'data:image/jpeg;base64,YQ==');
 assert.throws(()=>validateCapturedFrame('data:image/png;base64,YQ=='));
 assert.throws(()=>validateCapturedFrame('data:image/jpeg;base64,'+Buffer.alloc(AI_FRAME_LIMIT).toString('base64')));
});
function fixture(){
 const video={readyState:2,currentTime:0,videoWidth:1920,videoHeight:1080};let time=0,draws=0;
 const canvas={width:0,height:0,getContext:()=>({drawImage:()=>draws++}),toDataURL:(type,quality)=>{assert.equal(type,'image/jpeg');assert.equal(quality,.65);assert.equal(canvas.width,512);return 'data:image/jpeg;base64,YQ==';}};
 return {video,canvas,get draws(){return draws;},options:{createCanvas:()=>canvas,isHidden:()=>false,now:()=>time,wait:async ms=>{time+=ms;video.currentTime+=ms/1000;}}};
}
test('captures exactly four fresh reduced JPEGs and releases canvas',async()=>{
 const f=fixture(),progress=[];
 const result=await capturePoseFrames(f.video,{...f.options,onProgress:n=>progress.push(n)});
 assert.equal(result.length,4);assert.equal(f.draws,4);assert.deepEqual(progress,[1,2,3,4]);assert.equal(f.canvas.width,0);
});
test('abort during capture prevents any further image collection',async()=>{
 const f=fixture(),controller=new AbortController();
 await assert.rejects(capturePoseFrames(f.video,{...f.options,signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
 assert.equal(f.draws,1);assert.equal(f.canvas.width,0);
});
test('hidden document prevents capture',async()=>{
 const f=fixture();await assert.rejects(capturePoseFrames(f.video,{...f.options,isHidden:()=>true}),{name:'AbortError'});assert.equal(f.draws,0);
});
test('frozen video fails instead of collecting duplicate frames',async()=>{
 const f=fixture();let time=0;
 await assert.rejects(capturePoseFrames(f.video,{...f.options,now:()=>time,wait:async ms=>{time+=ms;}}),/멈췄어요/);assert.equal(f.draws,0);
});
test('abortable delay rejects immediately for already cancelled work',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(waitForCapture(1000,controller.signal),{name:'AbortError'});
});
test('automatic measurement requires a supported exercise and explicit valid camera view',()=>{
 for(const [exercise,view] of [['squat','side'],['squat','front'],['lunge','left'],['lunge','right'],['pushup','side']]){
  assert.deepEqual(supportedAiSelection({exercise,supported:true,selection:{exercise,view}}),{exercise,view});
 }
 for(const result of [
  {exercise:'deadlift',supported:true,selection:{exercise:'deadlift',view:'side'}},
  {exercise:'squat',supported:false,selection:{exercise:'squat',view:'side'}},
  {exercise:null,supported:false},
  {exercise:'lunge',supported:true},
  {exercise:'squat',supported:true,selection:{exercise:'pushup',view:'side'}},
  {exercise:'lunge',supported:true,selection:{exercise:'lunge',view:'side'}},
  {exercise:'pushup',supported:true,selection:{exercise:'pushup',view:'front'}},
  {exercise:'constructor',supported:true,selection:{exercise:'constructor',view:'side'}},
 ])assert.equal(supportedAiSelection(result),null);
});
