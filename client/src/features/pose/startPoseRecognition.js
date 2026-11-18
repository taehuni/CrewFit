// These conservative 2D scores are product heuristics, not probabilities or
// evidence of exercise intent. Every suggestion requires user confirmation.
const SIDES = {left: {shoulder:11, elbow:13, wrist:15, hip:23, knee:25, ankle:27, heel:29, toe:31}, right: {shoulder:12, elbow:14, wrist:16, hip:24, knee:26, ankle:28, heel:30, toe:32}};
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const mid = (a,b) => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function angle(a,b,c) {
 const size=distance(a,b)*distance(b,c);
 return size<1e-6 ? 0 : Math.acos(Math.max(-1,Math.min(1,((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))/size)))*180/Math.PI;
}
function points(rows,w,h) {
 if(!Array.isArray(rows)||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return null;
 return rows.map(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.visibility)&&p.visibility>=.7&&p.x>=.03&&p.x<=.97&&p.y>=.03&&p.y<=.97 ? {x:p.x*w/h,y:p.y}:null);
}
function side(points,key,names) {
 const result={};
 for(const name of names){result[name]=points[SIDES[key][name]];if(!result[name])return null;}
 return result;
}
function evaluate(rows,w,h) {
 const p=points(rows,w,h);
 if(!p||!p[11]||!p[12])return null;
 const candidates=[];
 const add=(exercise,view,confidence,indices,scale)=>candidates.push({exercise,view,confidence,indices,scale});
 for(const key of ['left','right']) {
  const s=side(p,key,['shoulder','elbow','wrist','hip','knee','ankle']);
  if(!s)continue;
  const body=distance(s.shoulder,s.ankle),torso=distance(s.shoulder,s.hip),arm=distance(s.shoulder,s.wrist);
  // A horizontal body alone also describes lying down. Require straight legs,
  // a vertical extended supporting arm and wrists near the foot support level.
  if(body>.25&&torso>.08&&Math.abs(s.ankle.x-s.shoulder.x)>body*.9&&
   distance(p[11],p[12])<torso*.35&&angle(s.shoulder,s.hip,s.ankle)>=165&&
   angle(s.hip,s.knee,s.ankle)>=165&&angle(s.shoulder,s.elbow,s.wrist)>=160&&
   s.wrist.y-s.shoulder.y>body*.2&&arm<body*.7&&
   Math.abs(s.wrist.x-s.shoulder.x)<arm*.35&&
   s.knee.y<s.wrist.y-body*.08&&Math.abs(s.wrist.y-s.ankle.y)<body*.35) {
   add('pushup','side',.88,Object.values(SIDES[key]).slice(0,6).concat([11,12]),body);
  }
 }
 const l=side(p,'left',['shoulder','hip','knee','ankle']),r=side(p,'right',['shoulder','hip','knee','ankle']);
 if(l&&r) {
  const shoulder=mid(l.shoulder,r.shoulder),hip=mid(l.hip,r.hip),torso=distance(shoulder,hip);
  const leg=(distance(l.hip,l.knee)+distance(l.knee,l.ankle)+distance(r.hip,r.knee)+distance(r.knee,r.ankle))/2;
  const upright=torso>.08&&leg>.15&&hip.y-shoulder.y>torso*.94&&
   [l,r].every(s=>s.knee.y>s.hip.y+.03&&s.ankle.y>s.knee.y+.03&&angle(s.hip,s.knee,s.ankle)>=160);
  const width=distance(l.shoulder,r.shoulder)/torso,span=Math.abs(l.ankle.x-r.ankle.x)/leg;
  const level=Math.abs(l.ankle.y-r.ankle.y)<leg*.12;
  const indices=[11,12,23,24,25,26,27,28];
  if(upright&&level) {
   if(width<.3&&span<.18)add('squat','side',.78,indices,torso+leg);
   if(width>.65&&width<1.8&&Math.abs(l.shoulder.y-r.shoulder.y)<torso*.15&&
    Math.abs(l.hip.y-r.hip.y)<torso*.12&&span>.2&&span<.8&&
    Math.abs(l.ankle.x-l.hip.x)<leg*.22&&Math.abs(r.ankle.x-r.hip.x)<leg*.22&&
    (l.shoulder.x-r.shoulder.x)*(l.hip.x-r.hip.x)>0&&
    (l.hip.x-r.hip.x)*(l.ankle.x-r.ankle.x)>0)add('squat','front',.82,indices,torso+leg);
   if(width<.3&&span>.4&&span<1.3) {
    const lf=side(p,'left',['heel','toe']),rf=side(p,'right',['heel','toe']);
    if(lf&&rf) {
     const ld=lf.toe.x-lf.heel.x,rd=rf.toe.x-rf.heel.x;
     if(Math.abs(ld)>leg*.06&&Math.abs(rd)>leg*.06&&ld*rd>0) {
      const front=ld*(l.ankle.x-r.ankle.x)>0?'left':'right';
      add('lunge',front,.86,indices.concat([29,30,31,32]),torso+leg);
     }
    }
   }
  }
 }
 // Two visible sides of one pushup represent the same suggestion.
 const unique=[...new Map(candidates.map(c=>[c.exercise+':'+c.view,c])).values()].sort((a,b)=>b.confidence-a.confidence);
 if(!unique.length)return null;
 const best=unique[0],margin=best.confidence-(unique[1]?.confidence||0);
 if(margin<.15)return null;
 return {...best,margin,positions:best.indices.map(i=>p[i])};
}

export function classifyStartPose(landmarks,width,height) {
 const result=evaluate(landmarks,width,height);
 return result?{exercise:result.exercise,view:result.view,confidence:result.confidence,margin:result.margin}:null;
}

export function createStartPoseRecognizer() {
 let anchor=null,start=null,last=null,count=0,dimensions=null;
 const searching=()=>({state:'searching',selection:null});
 function reset(){anchor=null;start=null;last=null;count=0;dimensions=null;return searching();}
 return {reset,update(rows,w,h,time) {
  const result=evaluate(rows,w,h);
  if(!result||!Number.isFinite(time)||time<0)return reset();
  const discontinuity=last!==null&&(time<=last||time-last>500);
  const changed=!anchor||anchor.exercise!==result.exercise||anchor.view!==result.view||
   dimensions?.[0]!==w||dimensions?.[1]!==h||anchor.indices.join()!==result.indices.join();
  const moved=anchor&&!changed&&result.positions.some((p,i)=>distance(p,anchor.positions[i])>anchor.scale*.035);
  if(discontinuity||changed||moved){anchor=result;start=time;count=0;dimensions=[w,h];}
  last=time;count++;
  return {state:time-start>=1200&&count>=8?'ready':'candidate',selection:{exercise:result.exercise,view:result.view}};
 }};
}
