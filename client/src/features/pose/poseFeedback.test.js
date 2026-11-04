import test from 'node:test';
import assert from 'node:assert/strict';
import {createFormFeedback} from './poseFeedback.js';
function frame({angle=170,heelRise=0,lean=0,side='left',footVisibility=.95,front=false}={}){
 const landmarks=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
 landmarks[11]={x:.5,y:.3,visibility:.95};landmarks[12]={x:front?.8:.51,y:.3,visibility:.95};
 const heel=side==='left'?29:30,toe=side==='left'?31:32;
 landmarks[heel]={x:.4,y:.85-heelRise,visibility:footVisibility};landmarks[toe]={x:.5,y:.85,visibility:footVisibility};
 const radians=lean*Math.PI/180;
 return {pose:{valid:true,angle,side,points:{hip:{x:500,y:500},shoulder:{x:500+200*Math.sin(radians),y:500-200*Math.cos(radians)}}},landmarks};
}
function session(){const engine=createFormFeedback();let time=0;return {engine,send(options={},delta=33){time+=delta;const f=frame(options);return engine.update(f.pose,f.landmarks,1000,1000,time);},repeat(options={},count=12){let result;for(let i=0;i<count;i++)result=this.send(options);return result;},lost(){time+=33;return engine.update({valid:false},[],1000,1000,time);}};}
const state=(result,key)=>result.items.find(i=>i.key===key).state;
test('calibrates only after 12 consecutive standing frames with visible feet',()=>{
 const s=session();assert.equal(s.repeat({},11).ready,false);assert.equal(s.send().ready,true);
 const missing=session();missing.repeat({},6);missing.send({footVisibility:.69});assert.equal(missing.repeat({},11).ready,false);assert.equal(missing.send().ready,true);
 const bent=session();bent.repeat({},6);bent.send({angle:140});assert.equal(bent.repeat({},11).ready,false);
});
test('heel observation requires five consecutive frames and clears immediately when the foot is lost',()=>{
 const s=session();s.repeat();assert.equal(state(s.repeat({angle:100,heelRise:.04},4),'heel'),'unknown');
 const raised=s.send({angle:100,heelRise:.04});assert.equal(state(raised,'heel'),'observe');assert.match(raised.items[0].message,/발바닥 접촉/);
 assert.equal(state(s.send({angle:100,footVisibility:.2}),'heel'),'unknown');
 assert.equal(state(s.repeat({angle:100},4),'heel'),'unknown');assert.equal(state(s.send({angle:100}),'heel'),'steady');
});
test('heel variation below threshold and isolated high frames never produce an observation',()=>{
 const s=session();s.repeat();for(let i=0;i<5;i++){s.send({angle:100,heelRise:.04});assert.equal(state(s.send({angle:100,heelRise:.01}),'heel'),'unknown');}
 assert.equal(state(s.repeat({angle:100,heelRise:.01},5),'heel'),'steady');
});
test('torso observation uses both absolute lean and baseline delta, with neutral qualified wording',()=>{
 const s=session();s.repeat({lean:10});assert.equal(state(s.repeat({angle:100,lean:70},4),'torso'),'unknown');
 const result=s.send({angle:100,lean:70});assert.equal(state(result,'torso'),'observe');assert.match(result.items[1].message,/체형/);assert.match(result.items[1].message,/자체가 오류는 아니에요/);
 const largeBaseline=session();largeBaseline.repeat({lean:30});assert.equal(state(largeBaseline.repeat({angle:100,lean:70},5),'torso'),'steady');
});
test('side changes, pose loss and long frame gaps discard calibration and old feedback',()=>{
 const s=session();s.repeat();s.repeat({angle:100,heelRise:.04},5);
 assert.equal(s.send({angle:100,side:'right'}).ready,false);assert.equal(state(s.send({angle:100,side:'right'}),'heel'),'unknown');
 s.repeat({side:'right'});assert.equal(s.lost().ready,false);assert.equal(s.send({side:'right',angle:100}).ready,false);
 s.repeat();assert.equal(s.send({},701).ready,false);assert.equal(s.send({angle:100}).ready,false);
 assert.equal(s.engine.reset().ready,false);
});
test('front-facing gate needs both shoulders but permits an occluded far shoulder',()=>{
 const s=session();assert.equal(s.repeat({front:true}).ready,false);
 const engine=createFormFeedback();let result;for(let n=1;n<=12;n++){const f=frame();f.landmarks[12].visibility=.2;result=engine.update(f.pose,f.landmarks,1000,1000,n*33);}assert.equal(result.ready,true);
});
test('depth is an angle observation without a normal or safe classification',()=>{
 const s=session();const result=s.send({angle:98});const depth=result.items.find(i=>i.key==='depth');assert.equal(depth.state,'observe');assert.match(depth.message,/98°/);assert.match(depth.message,/판단할 수 없어요/);
});
