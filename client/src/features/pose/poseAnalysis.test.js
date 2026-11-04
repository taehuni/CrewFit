import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePose,createRepCounter} from './poseAnalysis.js';

function pose(width=1000,height=500,side='left'){
 const rows=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
 const indexes=side==='left'?[11,23,25,27]:[12,24,26,28];
 // Hip-knee-ankle have perpendicular pixel vectors, but not normalized vectors.
 const points=[[300,60],[300,100],[400,200],[500,100]];
 indexes.forEach((index,i)=>{rows[index]={x:points[i][0]/width,y:points[i][1]/height,visibility:.95};});
 return rows;
}
test('uses pixel aspect ratio for knee angle and returns the selected joint pixel positions',()=>{
 const result=analyzePose(pose(),1000,500);assert.equal(result.valid,true);assert.ok(Math.abs(result.angle-90)<1e-9);
 assert.equal(result.side,'left');assert.deepEqual(result.points.knee,{x:400,y:200});
});
test('requires all four joints, visibility and frame margins; accepts the documented thresholds',()=>{
 for(const patch of [{visibility:.64},{x:.029},{y:.971},{x:NaN},{visibility:undefined}]){const rows=pose();rows[23]={...rows[23],...patch};assert.equal(analyzePose(rows,1000,500).valid,false);}
 const rows=pose();rows[11].visibility=.65;rows[11].y=.03;assert.equal(analyzePose(rows,1000,500).valid,true);
 rows[25]=null;assert.equal(analyzePose(rows,1000,500).valid,false);
 assert.equal(analyzePose(null,1000,500).valid,false);assert.equal(analyzePose(pose(),0,500).valid,false);
});
test('prefers a fixed side over confidence differences and falls back only when unavailable',()=>{
 const rows=pose(),right=pose(1000,500,'right');for(const i of [12,24,26,28])rows[i]=right[i];
 for(const i of [11,23,25,27])rows[i].visibility=.66;
 assert.equal(analyzePose(rows,1000,500).side,'left');rows[23].visibility=.2;
 assert.equal(analyzePose(rows,1000,500).side,'right');
});
test('rejects coincident knee joints rather than inventing an angle',()=>{const rows=pose();rows[23]={...rows[25]};assert.equal(analyzePose(rows,1000,500).valid,false);});

function tracker(){const counter=createRepCounter();let time=0;return {counter,frame(angle,delta=100){time+=delta;return counter.update(angle,time);},frames(angles,delta=100){let value;for(const angle of angles)value=this.frame(angle,delta);return value;}};}
test('requires standing first, then three low frames and three standing frames for one full repetition',()=>{
 const t=tracker();assert.deepEqual(t.frames([90,90,90]),{count:0,phase:'waiting'});
 assert.deepEqual(t.frames([170,170,170]),{count:0,phase:'standing'});
 assert.deepEqual(t.frames([145,120,100,100,100]),{count:0,phase:'down'});
 assert.deepEqual(t.frames([120,140,170,170,170]),{count:1,phase:'standing'});
 assert.equal(t.frames(Array(20).fill(175)).count,1);
 assert.equal(t.frames([140,120,100,100,100,120,140,170,170,170]).count,2);
});
test('threshold jitter and incomplete motion do not create a repetition',()=>{
 const t=tracker();t.frames([170,170,170]);
 t.frames([104,106,104,106,104,140,170,170,170]);assert.equal(t.frames([170,170,170]).count,0);
 t.frames([140,100,100,100]);t.frames([160,159,160,159]);assert.equal(t.frame(160).phase,'down');
 assert.equal(t.frames([160,160]).count,1);
});
test('rejects an implausibly fast cycle and never credits it later while standing still',()=>{
 const t=tracker();t.frames([170,170,170],20);t.frames([100,100,100,170,170,170],20);
 assert.equal(t.frames(Array(15).fill(170)).count,0);
});
test('tracking loss breaks partial reps but preserves completed count; reset clears everything',()=>{
 const t=tracker();t.frames([170,170,170,140,120,100,100,100,120,140,170,170,170]);
 t.frames([140,100,100,100]);assert.deepEqual(t.frame(null),{count:1,phase:'waiting'});
 assert.deepEqual(t.frames([170,170,170]),{count:1,phase:'standing'});
 t.frames([140,100,100,100]);assert.equal(t.frame(170,1200).phase,'waiting');assert.equal(t.frames([170,170,170]).count,1);
 assert.deepEqual(t.counter.reset(),{count:0,phase:'waiting'});
});
test('non-monotonic timestamps cannot reuse the same frame as three stable samples',()=>{
 const counter=createRepCounter();counter.update(170,100);counter.update(170,100);
 assert.equal(counter.update(170,100).phase,'waiting');assert.equal(counter.update(170,200).phase,'waiting');
});
