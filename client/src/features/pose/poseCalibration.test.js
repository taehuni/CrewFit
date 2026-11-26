import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeExercise,createExerciseFeedback} from './exerciseAnalysis.js';
import {createPoseCalibration} from './poseCalibration.js';

const blank=()=>Array.from({length:33},()=>({x:0,y:0,visibility:0}));
function landmarks(points){const rows=blank();for(const [index,x,y] of points)rows[index]={x,y,visibility:.95};return rows;}
const squat=()=>landmarks([[11,.5,.2],[12,.51,.2],[23,.5,.45],[25,.5,.65],[27,.5,.85],[29,.46,.85],[31,.55,.85]]);
const front=()=>landmarks([[11,.375,.2],[12,.625,.2],[23,.4,.4],[24,.6,.4],[25,.4,.6],[26,.6,.6],[27,.4,.8],[28,.6,.8]]);
const lunge=()=>landmarks([[11,.4,.2],[12,.41,.2],[23,.4,.4],[25,.4,.6],[27,.4,.8],[28,.1,.8],[29,.38,.82],[31,.45,.82]]);
const rightLunge=()=>{const left=lunge(),right=blank();for(const index of [11,13,15,23,25,27,29,31]){right[index]=left[index+1];right[index+1]=left[index];}return right;};
const pushup=()=>landmarks([[11,.25,.4],[13,.25,.55],[15,.25,.7],[23,.5,.4],[27,.8,.4]]);
function bentSquat(){const rows=squat();rows[23].x=.35;rows[23].y=.65;rows[11].x=.35;rows[11].y=.4;rows[12].x=.36;rows[12].y=.4;return rows;}
function rightSide(rows){const result=blank();for(const left of [11,13,15,23,25,27,29,31])result[left+1]={...rows[left]};return result;}
function session(exercise='squat',view='side'){
 const engine=createExerciseFeedback(exercise,view),gate=createPoseCalibration({front:exercise==='squat'&&view==='front'});
 let time=0;
 return {send(rows,delta=120){time+=delta;const pose=analyzeExercise(rows,1000,1000,exercise,view),feedback=engine.update(pose,rows,1000,1000,time);return {...gate.update({pose,feedback,time}),feedback};},repeat(rows,count){let result;for(let n=0;n<count;n++)result=this.send(rows);return result;}};
}

test('all local exercises wait for their baseline and a prepared repetition endpoint',()=>{
 for(const [exercise,view,fixture] of [['squat','side',squat],['lunge','left',lunge],['lunge','right',rightLunge],['pushup','side',pushup]]){
  const run=session(exercise,view);
  assert.equal(run.repeat(fixture(),11).ready,false,exercise);
  const baseline=run.send(fixture());
  assert.equal(baseline.feedback.ready,true,exercise);
  assert.equal(baseline.ready,false,exercise);
  assert.equal(run.send(fixture()).ready,false,exercise);
  const ready=run.send(fixture());assert.equal(ready.ready,true,exercise);assert.equal(ready.rep.phase,'standing',exercise);assert.equal(ready.rep.count,0,exercise);
 }
 const run=session('squat','front');assert.equal(run.repeat(front(),11).ready,false);
 const ready=run.send(front());assert.equal(ready.ready,true);assert.equal(ready.rep.count,0);
});

test('moving before preparation is complete cannot start measurement or count repetitions',()=>{
 const run=session();assert.equal(run.repeat(squat(),6).ready,false);
 const early=run.repeat(bentSquat(),12);assert.equal(early.ready,false);assert.equal(early.rep.count,0);
 assert.equal(run.repeat(squat(),13).ready,false);assert.equal(run.send(squat()).ready,true);
 // There is no reset between ready and measurement: the very first full repetition counts.
 assert.equal(run.repeat(bentSquat(),8).rep.phase,'down');
 const first=run.repeat(squat(),3);assert.equal(first.ready,true);assert.equal(first.rep.count,1);
});

test('the calibrated feedback engine immediately observes persistent movement after preparation',()=>{
 const run=session();run.repeat(squat(),14);
 const raised=bentSquat();raised[29].y=.81;
 assert.equal(run.repeat(raised,4).feedback.items.find(row=>row.key==='heel').state,'unknown');
 const result=run.send(raised);assert.equal(result.ready,true);assert.equal(result.feedback.items.find(row=>row.key==='heel').state,'observe');
});

test('side squat can count visible joint movement while the heel baseline remains unavailable',()=>{
 const withoutFeet=rows=>{rows[29].visibility=rows[31].visibility=.69;return rows;};
 const run=session();assert.equal(run.repeat(withoutFeet(squat()),13).ready,false);
 const prepared=run.send(withoutFeet(squat()));assert.equal(prepared.ready,true);
 assert.equal(prepared.feedback.items.find(row=>row.key==='heel').state,'unknown');
 run.repeat(withoutFeet(bentSquat()),8);
 const first=run.repeat(withoutFeet(squat()),3);assert.equal(first.ready,true);assert.equal(first.rep.count,1);
 assert.equal(first.feedback.items.find(row=>row.key==='heel').state,'unknown');
});

test('tracking loss pauses readiness, preserves completed repetitions, and never bridges a partial rep',()=>{
 const run=session();run.repeat(squat(),14);run.repeat(bentSquat(),8);assert.equal(run.repeat(squat(),3).rep.count,1);
 run.repeat(bentSquat(),4);
 const lost=run.send(blank());assert.equal(lost.ready,false);assert.equal(lost.rep.count,1);
 assert.equal(run.repeat(squat(),13).ready,false);
 const recovered=run.send(squat());assert.equal(recovered.ready,true);assert.equal(recovered.rep.count,1);
 run.repeat(bentSquat(),8);assert.equal(run.repeat(squat(),3).rep.count,2);
});

test('side changes and long frame gaps require a fresh baseline before resuming',()=>{
 for(const interrupt of [run=>run.send(rightSide(squat())),run=>run.send(squat(),701)]){
  const run=session();run.repeat(squat(),14);
  const stopped=interrupt(run);assert.equal(stopped.ready,false);assert.equal(stopped.rep.count,0);
  // Returning to the original side can itself invalidate the first frame.
  assert.equal(run.repeat(squat(),11).ready,false);
  assert.equal(run.repeat(squat(),4).ready,true);
 }
});
