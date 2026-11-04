import test from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISES,analyzeExercise,createExerciseFeedback} from './exerciseAnalysis.js';
const blank=()=>Array.from({length:33},()=>({x:0,y:0,visibility:0}));
const set=(rows,index,x,y)=>{rows[index]={x,y,visibility:.95};};
function front(){const r=blank();for(const [index,x,y] of [[11,.375,.2],[12,.625,.2],[23,.4,.4],[24,.6,.4],[25,.4,.6],[26,.6,.6],[27,.4,.8],[28,.6,.8]])set(r,index,x,y);return r;}
function lunge(){const r=front();for(const [index,x,y] of [[11,.4,.2],[12,.41,.2],[23,.4,.4],[25,.4,.6],[27,.4,.8],[28,.1,.8],[29,.38,.82],[31,.45,.82]])set(r,index,x,y);return r;}
function pushup(){const r=blank();for(const [index,x,y] of [[11,.25,.4],[13,.25,.55],[15,.25,.7],[23,.5,.4],[27,.8,.4]])set(r,index,x,y);return r;}
function session(exercise,view){const engine=createExerciseFeedback(exercise,view);let time=0;return {engine,send(rows,delta=33){time+=delta;const pose=analyzeExercise(rows,1000,1000,exercise,view);return engine.update(pose,rows,1000,1000,time);},repeat(rows,count=12){let result;for(let i=0;i<count;i++)result=this.send(rows);return result;}};}
const state=(result,key)=>result.items.find(row=>row.key===key).state;

test('all configured modes have supported guards and front squat never emits a rep angle',()=>{
 assert.deepEqual(EXERCISES.map(row=>row.id),['squat','lunge','pushup']);
 assert.equal(analyzeExercise(front(),1000,1000,'squat','front').angle,null);
 assert.equal(analyzeExercise(front(),1000,1000,'squat','front').side,'front');
 assert.equal(analyzeExercise(front(),1000,1000,'pushup','front').valid,false);
 assert.equal(analyzeExercise(front(),1000,1000,'lunge','side').valid,false);
 assert.equal(analyzeExercise(front(),0,1000,'squat','front').valid,false);
});
test('front squat rejects a side view, occlusion and coincident joints',()=>{
 const r=front();r[12].x=.4;assert.equal(analyzeExercise(r,1000,1000,'squat','front').valid,false);
 const missing=front();missing[26].visibility=.69;assert.equal(analyzeExercise(missing,1000,1000,'squat','front').valid,false);
 const coincident=front();coincident[25]={...coincident[23]};assert.equal(analyzeExercise(coincident,1000,1000,'squat','front').valid,false);
});
test('front knee cue is per leg, signed inward and sustained for five frames',()=>{
 const s=session('squat','front');assert.equal(s.repeat(front(),11).ready,false);assert.equal(s.send(front()).ready,true);
 const inward=front();inward[25].x+=.035;assert.equal(state(s.repeat(inward,4),'leftKnee'),'unknown');
 const result=s.send(inward);assert.equal(state(result,'leftKnee'),'observe');assert.equal(state(result,'rightKnee'),'steady');
 const outward=front();outward[25].x-=.04;assert.equal(state(s.repeat(outward,5),'leftKnee'),'steady');
});
test('front camera rotation and ankle-span changes reset calibration',()=>{
 const s=session('squat','front');s.repeat(front());const wide=front();wide[27].x=.35;wide[28].x=.65;assert.equal(s.send(wide).ready,false);
 s.repeat(front());const roll=front();roll[12].y+=.07;assert.equal(s.send(roll).ready,false);
});
test('front angle wrap around 180 degrees does not create a spurious camera rotation',()=>{
 const s=session('squat','front');let r;for(let i=0;i<12;i++){r=front();for(const p of r)p.x=1-p.x;r[12].y+=i%2?.001:-.001;s.send(r);}assert.equal(s.send(r).ready,true);
});
test('lunge locks to the user-selected leg and requires visible split stance and front foot',()=>{
 const rows=lunge();assert.equal(analyzeExercise(rows,1000,1000,'lunge','left').side,'left');
 assert.equal(analyzeExercise(rows,1000,1000,'lunge','right').valid,false);
 const closed=lunge();closed[28].x=.41;assert.equal(analyzeExercise(closed,1000,1000,'lunge','left').valid,false);
 const foot=lunge();foot[31].visibility=.2;assert.equal(analyzeExercise(foot,1000,1000,'lunge','left').valid,false);
 const back=lunge();back[28].x=.7;assert.equal(analyzeExercise(back,1000,1000,'lunge','left').valid,false);
 const ambiguous=lunge();ambiguous[31].x=ambiguous[29].x+.001;assert.equal(analyzeExercise(ambiguous,1000,1000,'lunge','left').valid,false);
 const mirrored=lunge().map(p=>({...p,x:1-p.x}));assert.equal(analyzeExercise(mirrored,1000,1000,'lunge','left').valid,true);
});
test('lunge requires split-stance calibration before showing foot cues and clears on missing foot',()=>{
 const s=session('lunge','left');assert.equal(s.repeat(lunge()).ready,true);
 const bent=lunge();set(bent,23,.25,.6);set(bent,25,.4,.65);set(bent,27,.4,.85);bent[29].y-=.035;
 assert.equal(analyzeExercise(bent,1000,1000,'lunge','left').valid,true);
 assert.equal(state(s.repeat(bent,5),'heel'),'observe');bent[29].visibility=.1;assert.equal(s.send(bent).ready,false);
 assert.equal(s.send(lunge()).ready,false);
});
test('pushup uses elbow geometry and rejects upright or missing full-body views',()=>{
 const p=analyzeExercise(pushup(),1000,1000,'pushup','side');assert.equal(p.valid,true);assert.ok(Math.abs(p.angle-180)<1e-8);
 const bent=pushup();set(bent,13,.38,.55);const a=analyzeExercise(bent,1000,1000,'pushup','side');assert.ok(a.angle>90&&a.angle<110);
 const wide=bent.map(point=>({...point,x:point.x/2}));assert.ok(Math.abs(analyzeExercise(wide,2000,1000,'pushup','side').angle-a.angle)<1e-8);
 const upright=pushup();set(upright,23,.25,.6);set(upright,27,.25,.85);assert.equal(analyzeExercise(upright,1000,1000,'pushup','side').valid,false);
 const hidden=pushup();hidden[27].visibility=.4;assert.equal(analyzeExercise(hidden,1000,1000,'pushup','side').valid,false);
});
test('pushup establishes a straight-body baseline then observes sustained hip departure',()=>{
 const s=session('pushup','side');const badStart=pushup();badStart[23].y=.55;assert.equal(s.repeat(badStart).ready,false);
 assert.equal(s.repeat(pushup()).ready,true);const sag=pushup();sag[23].y=.5;
 assert.equal(state(s.repeat(sag,4),'bodyLine'),'unknown');assert.equal(state(s.send(sag),'bodyLine'),'observe');
 assert.equal(state(s.repeat(pushup(),5),'bodyLine'),'steady');assert.equal(s.send(pushup(),701).ready,false);
});
test('missing incoming pose resets even if stale landmarks remain supplied',()=>{
 const s=session('pushup','side');s.repeat(pushup());assert.equal(s.engine.update({valid:false},pushup(),1000,1000,500).ready,false);
});
