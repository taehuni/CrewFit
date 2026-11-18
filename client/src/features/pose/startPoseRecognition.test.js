import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyStartPose,createStartPoseRecognizer} from './startPoseRecognition.js';
const blank=()=>Array.from({length:33},()=>({x:0,y:0,visibility:0}));
const set=(rows,index,x,y)=>{rows[index]={x,y,visibility:.95};};
function standing(front=false) {
 const rows=blank();
 for(const [base,x] of [[0,front?.4:.49],[1,front?.6:.51]])for(const [i,y] of [[11,.2],[23,.4],[25,.6],[27,.8]])set(rows,i+base,x,y);
 return rows;
}
function lunge(right=false) {
 const rows=standing();
 for(const [i,x,y] of [[23,.48,.4],[24,.5,.4],[25,.56,.6],[26,.38,.6],[27,.64,.8],[28,.26,.8],[29,.62,.82],[31,.69,.82],[30,.24,.82],[32,.31,.82]])set(rows,i,x,y);
 if(right)for(const i of [11,23,25,27,29,31])[rows[i],rows[i+1]]=[rows[i+1],rows[i]];
 return rows;
}
function pushup() {
 const rows=blank();
 for(const [i,x,y] of [[11,.2,.4],[12,.21,.4],[13,.2,.54],[15,.2,.68],[23,.45,.5],[25,.63,.572],[27,.8,.64]])set(rows,i,x,y);
 return rows;
}
const classify=rows=>classifyStartPose(rows,1000,1000);
const selection=rows=>{const p=classify(rows);return p&&[p.exercise,p.view];};
const mirror=rows=>rows.map(p=>({...p,x:1-p.x}));
test('clear upright candidates and left/right split stances retain anatomical labels when mirrored',()=>{
 assert.deepEqual(selection(standing()),['squat','side']);
 assert.deepEqual(selection(standing(true)),['squat','front']);
 for(const right of [false,true])for(const rows of [lunge(right),mirror(lunge(right))])assert.deepEqual(selection(rows),['lunge',right?'right':'left']);
 assert.deepEqual(selection(pushup()),['pushup','side']);
 assert.deepEqual(selection(mirror(pushup())),['pushup','side']);
 assert.ok(classify(standing()).margin>=.15);
});
test('aspect compensation preserves real geometry',()=>{
 for(const rows of [standing(),standing(true),lunge(),pushup()]) {
  const wide=rows.map(p=>({...p,x:p.x/2}));
  assert.deepEqual(classifyStartPose(wide,2000,1000),classify(rows));
 }
});
test('ambiguous angles, intermediate stance, crouching and camera roll produce no fallback squat',()=>{
 const angled=standing();angled[12].x=.59;
 assert.equal(classify(angled),null);
 const intermediate=standing();intermediate[27].x=.44;intermediate[28].x=.56;
 assert.equal(classify(intermediate),null);
 const bent=standing();bent[25].x=.7;assert.equal(classify(bent),null);
 for(const rows of [standing(),standing(true),lunge(),pushup()]) {
  const rolled=rows.map(p=>({...p,x:1-p.y,y:p.x}));
  assert.equal(classify(rolled),null);
 }
});
test('missing joints, absent visibility, invalid coordinates and invalid dimensions reject',()=>{
 for(const [make,index] of [[standing,25],[()=>standing(true),24],[lunge,32],[pushup,15],[pushup,25],[pushup,12]]) {
  for(const replacement of [null,{x:.5,y:.5},{x:.5,y:.5,visibility:.69},{x:NaN,y:.5,visibility:1},{x:1.01,y:.5,visibility:1}]) {
   const rows=make();rows[index]=replacement;assert.equal(classify(rows),null);
  }
 }
 for(const size of [0,-1,NaN,Infinity])assert.equal(classifyStartPose(standing(),size,1000),null);
 assert.equal(classify(null),null);
});
test('pushup rejects lying down, bent arms, bent knees, and unsupported horizontal arms',()=>{
 const lying=pushup();set(lying,13,.3,.44);set(lying,15,.4,.48);assert.equal(classify(lying),null);
 const bentArm=pushup();set(bentArm,13,.35,.54);assert.equal(classify(bentArm),null);
 const bentKnee=pushup();set(bentKnee,25,.6,.75);assert.equal(classify(bentKnee),null);
 const lifted=pushup();set(lifted,13,.2,.26);set(lifted,15,.2,.12);assert.equal(classify(lifted),null);
});
test('lunge requires consistent visible foot directions',()=>{
 const opposite=lunge();opposite[32].x=.19;assert.equal(classify(opposite),null);
 const ambiguous=lunge();ambiguous[31].x=ambiguous[29].x+.001;assert.equal(classify(ambiguous),null);
});
function hold(engine,rows,start=0) {
 let result;for(let time=start;time<=start+1200;time+=100)result=engine.update(rows,1000,1000,time);
 return result;
}
test('readiness requires elapsed time and stationary samples, and reset clears selection',()=>{
 const engine=createStartPoseRecognizer();
 for(let time=0;time<1200;time+=100)assert.equal(engine.update(standing(),1000,1000,time).state,'candidate');
 assert.deepEqual(engine.update(standing(),1000,1000,1200),{state:'ready',selection:{exercise:'squat',view:'side'}});
 assert.deepEqual(engine.reset(),{state:'searching',selection:null});
 assert.equal(engine.update(standing(),1000,1000,1300).state,'candidate');
 const sparse=createStartPoseRecognizer();for(let time=0;time<=1200;time+=400)assert.equal(sparse.update(standing(),1000,1000,time).state,'candidate');
});
test('slow cumulative motion cannot become ready even when every frame classifies',()=>{
 const engine=createStartPoseRecognizer();
 for(let frame=0;frame<25;frame++) {
  const moving=standing().map(p=>({...p,x:p.x+frame*.004}));
  assert.ok(classify(moving));assert.equal(engine.update(moving,1000,1000,frame*100).state,'candidate');
 }
});
test('small tracking jitter is tolerated, but movement immediately removes readiness',()=>{
 const engine=createStartPoseRecognizer();let result;
 for(let frame=0;frame<=12;frame++) {
  const rows=standing().map(p=>({...p,x:p.x+(frame%2?.001:-.001)}));
  result=engine.update(rows,1000,1000,frame*100);
 }
 assert.equal(result.state,'ready');
 const moved=standing().map(p=>({...p,x:p.x+.04}));
 assert.equal(engine.update(moved,1000,1000,1300).state,'candidate');
});
test('ready state does not survive changed pose, missing evidence, gap, rotation or dimensions',()=>{
 for(const replacement of [standing(true),lunge(),pushup()]) {
  const engine=createStartPoseRecognizer();assert.equal(hold(engine,standing()).state,'ready');
  assert.equal(engine.update(replacement,1000,1000,1300).state,'candidate');
  assert.equal(hold(engine,replacement,1400).state,'ready');
 }
 for(const [rows,w,h,time] of [[blank(),1000,1000,1300],[standing(),1000,1000,2000],[standing(),1000,1000,1200],[standing(),2000,2000,1300],[standing(),1000,1000,NaN],[standing().map(p=>({...p,x:1-p.y,y:p.x})),1000,1000,1300]]) {
  const engine=createStartPoseRecognizer();hold(engine,standing());
  assert.notEqual(engine.update(rows,w,h,time).state,'ready');
 }
});
