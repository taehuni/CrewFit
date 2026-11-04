import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecognitionGate} from './recognitionGate.js';
const squat={exercise:'squat',view:'side',confidence:.9,margin:.3};
const lunge={exercise:'lunge',view:'left',confidence:.9,margin:.3};
function stabilize(gate,value=squat,from=0){let result;for(let i=0;i<6;i++)result=gate.update(value,from+i*200);return result;}
test('requires both consecutive frame count and elapsed duration before locking',()=>{
 const gate=createRecognitionGate();assert.deepEqual(gate.update(squat,0),{state:'candidate',selection:{exercise:'squat',view:'side'},ready:false});
 for(let i=1;i<6;i++)assert.equal(gate.update(squat,i*100).ready,false);
 assert.equal(gate.update(squat,1000).ready,true);
 const few=createRecognitionGate();few.update(squat,0);few.update(squat,500);assert.equal(few.update(squat,1000).ready,false);
});
test('changing candidate restarts the full observation period',()=>{
 const gate=createRecognitionGate();gate.update(squat,0);gate.update(squat,500);
 assert.equal(gate.update(lunge,600).state,'candidate');assert.equal(gate.update(lunge,1000).ready,false);
 assert.deepEqual(stabilize(gate,lunge,1200),{state:'locked',selection:{exercise:'lunge',view:'left'},ready:true});
});
test('allowlist, score types, confidence and margin reject uncertain classifications',()=>{
 for(const value of [null,{...squat,exercise:'unknown'},{...squat,exercise:'toString'},{...squat,view:'left'},{...squat,confidence:.79},{...squat,margin:.19},{...squat,confidence:NaN},{...squat,margin:Infinity},{...squat,confidence:'0.9'},{...squat,confidence:1.1}]){
  const gate=createRecognitionGate();gate.update(squat,0);assert.deepEqual(gate.update(value,200),{state:'searching',selection:null,ready:false});
 }
 for(const [exercise,view] of [['squat','side'],['squat','front'],['lunge','left'],['lunge','right'],['pushup','side']])assert.equal(stabilize(createRecognitionGate(),{exercise,view,confidence:.8,margin:.2}).ready,true);
});
test('a locked selection stays fixed through unknown or different exercises but readiness stops immediately',()=>{
 const gate=createRecognitionGate();stabilize(gate);
 assert.deepEqual(gate.update(lunge,1200),{state:'locked',selection:{exercise:'squat',view:'side'},ready:false});
 for(let i=0;i<12;i++)assert.equal(gate.update(lunge,1400+i*200).ready,false);
 assert.deepEqual(gate.update(null,3800),{state:'locked',selection:{exercise:'squat',view:'side'},ready:false});
 for(let i=0;i<5;i++)assert.equal(gate.update(squat,4000+i*200).ready,false);
 assert.equal(gate.update(squat,5000).ready,true);
});
test('gaps, duplicate times, backwards times and invalid clocks interrupt readiness without changing a lock',()=>{
 for(const time of [1000,900,1701,NaN,-1]){
  const gate=createRecognitionGate();stabilize(gate);const result=gate.update(squat,time);assert.equal(result.ready,false);assert.equal(result.state,'locked');assert.deepEqual(result.selection,{exercise:'squat',view:'side'});
 }
 const gate=createRecognitionGate();gate.update(squat,0);assert.equal(gate.update(squat,701).state,'searching');assert.equal(gate.update(squat,800).state,'candidate');
});
test('reset removes the lock and returned selections cannot mutate internal state',()=>{
 const gate=createRecognitionGate();const result=stabilize(gate);result.selection.exercise='lunge';assert.equal(gate.update(squat,1200).selection.exercise,'squat');
 assert.deepEqual(gate.reset(),{state:'searching',selection:null,ready:false});assert.equal(stabilize(gate,lunge).selection.exercise,'lunge');
});
test('custom thresholds are supported and invalid options cannot silently disable the gate',()=>{
 const gate=createRecognitionGate({minFrames:2,minDurationMs:100,minConfidence:.95,minMargin:.4});const value={...squat,confidence:.95,margin:.4};gate.update(value,0);assert.equal(gate.update(value,100).ready,true);
 for(const options of [{minFrames:0},{minFrames:1.5},{minDurationMs:-1},{minConfidence:NaN},{minMargin:1.1}])assert.throws(()=>createRecognitionGate(options),TypeError);
});
