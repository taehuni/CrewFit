import {analyzePose} from './poseAnalysis.js';
import {createFormFeedback} from './poseFeedback.js';

export const EXERCISES=[
 {id:'squat',label:'스쿼트',views:[{id:'side',label:'측면'},{id:'front',label:'정면'}],setup:'전신과 발을 화면에 담고 먼저 서 있는 자세를 유지해 주세요.',scope:'측면은 무릎 각도·뒤꿈치·상체, 정면은 화면상의 무릎 이동만 관찰해요. 정면에서는 횟수를 세지 않아요.',metricLabel:'무릎 각도'},
 {id:'lunge',label:'런지',views:[{id:'left',label:'왼쪽 다리 앞으로'},{id:'right',label:'오른쪽 다리 앞으로'}],setup:'본인 기준 앞에 놓을 다리를 선택하고, 측면에서 두 발을 앞뒤로 벌린 채 앞무릎을 펴 주세요.',scope:'선택한 앞다리의 무릎 각도·뒤꿈치·상체 변화만 관찰해요.',metricLabel:'앞무릎 각도'},
 {id:'pushup',label:'푸시업',views:[{id:'side',label:'측면'}],setup:'손부터 발까지 보이게 카메라를 옆에 두고, 팔을 편 시작 자세를 유지해 주세요.',scope:'팔꿈치 각도와 어깨·발목 선에 대한 골반 이동을 관찰해요. 무릎 대고 하는 변형은 지원하지 않아요.',metricLabel:'팔꿈치 각도'}
];
const INDEX={left:{shoulder:11,elbow:13,wrist:15,hip:23,knee:25,ankle:27,heel:29,toe:31},right:{shoulder:12,elbow:14,wrist:16,hip:24,knee:26,ankle:28,heel:30,toe:32}};
const bad=message=>({valid:false,angle:null,side:null,points:null,segments:[],message});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function angle(a,b,c){const u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y},size=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);return size<1?null:Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/size)))*180/Math.PI;}
function point(rows,index,w,h){const p=rows?.[index];return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.visibility)&&p.visibility>=.7&&p.x>=.03&&p.x<=.97&&p.y>=.03&&p.y<=.97?{x:p.x*w,y:p.y*h}:null;}
function sidePoints(rows,w,h,side,names){const points={};for(const name of names){points[name]=point(rows,INDEX[side][name],w,h);if(!points[name])return null;}return points;}
function frontPoints(rows,w,h){const points={};for(const side of ['left','right'])for(const name of ['shoulder','hip','knee','ankle']){const key=side+name[0].toUpperCase()+name.slice(1);points[key]=point(rows,INDEX[side][name],w,h);if(!points[key])return null;}return points;}
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function sideGate(rows,w,h,p){const l=point(rows,11,w,h),r=point(rows,12,w,h);return !l||!r||Math.abs(l.x-r.x)/distance(p.shoulder,p.hip)<=.45;}

export function analyzeExercise(rows,w,h,exercise,view,preferredSide=null){
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||!Array.isArray(rows))return bad('카메라에서 전신을 확인하고 있어요.');
 const config=EXERCISES.find(p=>p.id===exercise);if(!config?.views.some(p=>p.id===view))return bad('운동과 촬영 방향을 다시 선택해 주세요.');
 if(exercise==='squat'&&view==='side')return analyzePose(rows,w,h,preferredSide);
 if(exercise==='squat'){
  const p=frontPoints(rows,w,h);if(!p)return bad('정면에서 양쪽 어깨·골반·무릎·발목이 모두 보이도록 서 주세요.');
  const torso=distance(mid(p.leftShoulder,p.rightShoulder),mid(p.leftHip,p.rightHip));
  if(torso<1||Math.abs(p.leftShoulder.x-p.rightShoulder.x)/torso<=.5||Math.abs(p.leftAnkle.x-p.rightAnkle.x)<1)return bad('정면으로 서서 양쪽 발을 화면에 담아 주세요.');
  if(angle(p.leftHip,p.leftKnee,p.leftAnkle)===null||angle(p.rightHip,p.rightKnee,p.rightAnkle)===null)return bad('다리 위치를 다시 확인해 주세요.');
  return {valid:true,angle:null,side:'front',points:p,segments:[['leftShoulder','rightShoulder'],['leftHip','rightHip'],...['left','right'].flatMap(s=>[[s+'Shoulder',s+'Hip'],[s+'Hip',s+'Knee'],[s+'Knee',s+'Ankle']])],message:'정면 무릎 이동을 관찰해요. 횟수와 굽힘 깊이는 측정하지 않아요.'};
 }
 if(exercise==='lunge'){
  const p=sidePoints(rows,w,h,view,['shoulder','hip','knee','ankle','heel','toe']),other=point(rows,INDEX[view==='left'?'right':'left'].ankle,w,h);
  if(!p||!other)return bad('선택한 앞다리와 양쪽 발, 뒤꿈치·발끝을 모두 보여 주세요.');
  const leg=distance(p.hip,p.knee)+distance(p.knee,p.ankle),a=angle(p.hip,p.knee,p.ankle);
  if(!leg||a===null||distance(p.heel,p.toe)<1||!sideGate(rows,w,h,p)||Math.abs(p.ankle.x-other.x)<.3*leg)return bad('카메라를 옆에 두고, 두 발을 앞뒤로 충분히 벌려 주세요.');
  const footDirection=p.toe.x-p.heel.x;
  if(Math.abs(footDirection)<.02*leg||Math.sign(footDirection)*(p.ankle.x-other.x)<=0)return bad('선택한 다리가 앞에 있는지 확인해 주세요. 앞발의 뒤꿈치와 발끝이 옆에서 구분되어야 해요.');
  return {valid:true,angle:a,side:view,points:{...p,otherAnkle:other},segments:[['shoulder','hip'],['hip','knee'],['knee','ankle'],['heel','toe']],message:'선택한 앞다리의 움직임을 관찰하고 있어요.'};
 }
 for(const side of preferredSide==='right'?['right','left']:['left','right']){
  const p=sidePoints(rows,w,h,side,['shoulder','elbow','wrist','hip','ankle']);if(!p)continue;
  const a=angle(p.shoulder,p.elbow,p.wrist),body=angle(p.shoulder,p.hip,p.ankle);
  if(a===null||body===null||Math.abs(p.shoulder.x-p.hip.x)<=Math.abs(p.shoulder.y-p.hip.y)||distance(p.shoulder,p.ankle)<1)continue;
  return {valid:true,angle:a,side,points:p,segments:[['shoulder','elbow'],['elbow','wrist'],['shoulder','hip'],['hip','ankle']],message:'측면에서 팔꿈치와 몸통 선을 관찰하고 있어요.'};
 }
 return bad('옆에서 손·어깨·골반·발목이 모두 보이도록 푸시업 시작 자세를 잡아 주세요.');
}

const status=(key,label,state,message)=>({key,label,state,message});
const unknown=(key,label,message)=>status(key,label,'unknown',message);
const rotation=p=>Math.atan2(p.rightShoulder.y-p.leftShoulder.y,p.rightShoulder.x-p.leftShoulder.x)*180/Math.PI;
const rotationDelta=(a,b)=>Math.abs(((a-b+540)%360)-180);
function kneeDeviation(p,side){const other=side==='left'?'right':'left',hip=p[side+'Hip'],knee=p[side+'Knee'],ankle=p[side+'Ankle'],span=Math.abs(p.leftAnkle.x-p.rightAnkle.x),vertical=ankle.y-hip.y;if(Math.abs(vertical)<1||span<1)return null;const lineX=hip.x+(ankle.x-hip.x)*(knee.y-hip.y)/vertical;return (knee.x-lineX)*Math.sign(p[other+'Ankle'].x-ankle.x)/span;}
function hipOffset(p){const dx=p.ankle.x-p.shoulder.x,dy=p.ankle.y-p.shoulder.y;return (dx*(p.hip.y-p.shoulder.y)-dy*(p.hip.x-p.shoulder.x))/(dx*dx+dy*dy);}

// All thresholds below are unvalidated product heuristics. 2D movement cues are not diagnoses or safety scores.
export function createExerciseFeedback(exercise,view){
 if(exercise==='squat'&&view==='side')return createFormFeedback();
 const mode=exercise==='squat'&&view==='front'?'front':exercise==='lunge'&&['left','right'].includes(view)?'lunge':exercise==='pushup'&&view==='side'?'pushup':'invalid';
 const labels=mode==='front'?[['leftKnee','왼쪽 무릎'],['rightKnee','오른쪽 무릎']]:mode==='lunge'?[['heel','앞발 뒤꿈치'],['torso','상체 기울기']]:[['bodyLine','골반 위치']];
 let baseline=null,samples=[],last=null,side=null,streaks={};
 const empty=summary=>({ready:false,items:labels.map(([key,label])=>unknown(key,label,'기준 자세를 확인한 뒤 관찰해요.')),summary});
 function reset(){baseline=null;samples=[];last=null;side=null;streaks={};return empty('시작 자세를 유지해 기준을 확인해 주세요.');}
 function observe(key,label,condition,message,quiet){const s=streaks[key]||{high:0,low:0};s.high=condition?s.high+1:0;s.low=condition?0:s.low+1;streaks[key]=s;return s.high>=5?status(key,label,'observe',message):s.low>=5?status(key,label,'steady',quiet):unknown(key,label,'몇 프레임 더 관찰하고 있어요.');}
 return {reset,update(_pose,rows,w,h,time){
  const pose=analyzeExercise(rows,w,h,exercise,view,_pose?.side);
  if(mode==='invalid'||!_pose?.valid||!pose.valid||!Number.isFinite(time)||time<0){reset();return empty(pose.message||'전신이 보이도록 다시 준비해 주세요.');}
  if((last!==null&&(time<=last||time-last>700))||(side!==null&&side!==pose.side)){reset();last=time;side=pose.side;return empty('추적 조건이 바뀌었어요. 시작 자세부터 다시 확인해 주세요.');}
  last=time;side=pose.side;const p=pose.points;let values,standing;
  if(mode==='front'){
   const left=kneeDeviation(p,'left'),right=kneeDeviation(p,'right');
   if(left===null||right===null){reset();return empty('정면에서 다리 위치를 다시 확인해 주세요.');}
   values={left,right,span:Math.abs(p.leftAnkle.x-p.rightAnkle.x),rotation:rotation(p)};
   standing=angle(p.leftHip,p.leftKnee,p.leftAnkle)>=155&&angle(p.rightHip,p.rightKnee,p.rightAnkle)>=155&&p.leftHip.y<p.leftKnee.y&&p.rightHip.y<p.rightKnee.y;
   if(baseline&&(Math.abs(values.span/baseline.span-1)>.25||rotationDelta(values.rotation,baseline.rotation)>12)){reset();return empty('발 간격이나 촬영 방향이 바뀌었어요. 정면으로 서서 다시 기준을 확인해 주세요.');}
  }else if(mode==='pushup'){
   values={offset:hipOffset(p)};standing=pose.angle>=155&&angle(p.shoulder,p.hip,p.ankle)>=160;
  }else{
   values={heel:(p.toe.y-p.heel.y)/distance(p.toe,p.heel),torso:Math.abs(Math.atan2(p.shoulder.x-p.hip.x,p.hip.y-p.shoulder.y)*180/Math.PI)};standing=pose.angle>=155;
  }
  if(!baseline){
   if(standing)samples.push(values);else samples=[];
   if(samples.length<12)return empty('시작 자세를 유지해 주세요. 기준 확인 '+samples.length+'/12');
   baseline=Object.fromEntries(Object.keys(values).map(key=>[key,key==='rotation'?Math.atan2(samples.reduce((sum,row)=>sum+Math.sin(row.rotation*Math.PI/180),0),samples.reduce((sum,row)=>sum+Math.cos(row.rotation*Math.PI/180),0))*180/Math.PI:samples.reduce((sum,row)=>sum+row[key],0)/samples.length]));samples=[];
  }
  if(mode==='front')return {ready:true,items:[observe('leftKnee','왼쪽 무릎',values.left-baseline.left>.12,'왼쪽 무릎이 기준보다 안쪽으로 이동하는 모습이 반복돼요. 촬영 각도와 발 위치를 확인해 주세요.','뚜렷한 안쪽 이동 신호는 관찰되지 않았어요.'),observe('rightKnee','오른쪽 무릎',values.right-baseline.right>.12,'오른쪽 무릎이 기준보다 안쪽으로 이동하는 모습이 반복돼요. 촬영 각도와 발 위치를 확인해 주세요.','뚜렷한 안쪽 이동 신호는 관찰되지 않았어요.')],summary:'정면의 2D 이동만 관찰해요. 무릎의 실제 회전이나 안전성을 판단하지 않아요.'};
  if(mode==='pushup')return {ready:true,items:[observe('bodyLine','골반 위치',Math.abs(values.offset-baseline.offset)>.08,'골반이 기준보다 어깨·발목 선에서 벗어나는 모습이 반복돼요. 몸통 위치와 촬영 각도를 확인해 주세요.','기준 대비 뚜렷한 골반 이탈 신호는 관찰되지 않았어요.')],summary:'팔꿈치 각도와 화면상의 몸통 변화만 관찰해요. 자세의 안전성을 판정하지 않아요.'};
  if(pose.angle>=145){streaks={};return {ready:true,items:labels.map(([key,label])=>unknown(key,label,'앞무릎을 굽히는 동안 변화를 관찰해요.')),summary:'앞다리 기준을 확인했어요. 편안한 범위에서 움직여 보세요.'};}
  return {ready:true,items:[observe('heel','앞발 뒤꿈치',values.heel-baseline.heel>.18,'앞발 뒤꿈치가 들리는 모습이 반복돼요. 발바닥 접촉을 확인해 주세요.','뚜렷한 들림 신호는 관찰되지 않았어요.'),observe('torso','상체 기울기',values.torso-baseline.torso>45&&values.torso>55,'기준보다 상체 기울기가 크게 늘어난 모습이 반복돼요. 체형과 동작에 따라 달라지며, 앞기울임 자체가 오류는 아니에요.','기준 대비 큰 기울기 증가 신호는 관찰되지 않았어요.')],summary:'선택한 앞다리의 2D 움직임만 관찰해요. 체형이나 안전성을 판정하지 않아요.'};
 }};
}
