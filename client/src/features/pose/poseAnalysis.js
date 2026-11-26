const SIDES={left:{shoulder:11,hip:23,knee:25,ankle:27},right:{shoulder:12,hip:24,knee:26,ankle:28}};
const invalid=message=>({valid:false,angle:null,side:null,points:null,message});

/** Geometry only: this angle is not an assessment of exercise safety or form. */
export function analyzePose(landmarks,width,height,preferredSide=null){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return invalid('카메라 화면을 준비하고 있어요.');
 if(!Array.isArray(landmarks))return invalid('옆모습과 전신이 화면에 보이도록 서 주세요.');
 // Keep a previously selected side while it remains valid, then fall back.
 // The caller should reset tracking if the selected side changes between frames.
 const sides=preferredSide==='right'?['right','left']:['left','right'];
 for(const side of sides){
  const indexes=SIDES[side];
  const points={};let valid=true;
  for(const [name,index] of Object.entries(indexes)){
   const point=landmarks[index];
   if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.visibility)||point.visibility<.65||point.x<.03||point.x>.97||point.y<.03||point.y>.97){valid=false;break;}
   points[name]={x:point.x*width,y:point.y*height};
  }
  if(!valid)continue;
  const upper={x:points.hip.x-points.knee.x,y:points.hip.y-points.knee.y};
  const lower={x:points.ankle.x-points.knee.x,y:points.ankle.y-points.knee.y};
  const upperLength=Math.hypot(upper.x,upper.y),lowerLength=Math.hypot(lower.x,lower.y);
  if(upperLength<1||lowerLength<1)continue;
  const cosine=(upper.x*lower.x+upper.y*lower.y)/(upperLength*lowerLength);
  const angle=Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI;
  return {valid:true,angle,side,points,message:'무릎 각도를 측정하고 있어요.'};
 }
 return invalid('어깨부터 발목까지 화면 안에 보이도록 위치를 조정해 주세요.');
}

/** Three consecutive frames at each endpoint; missing frames never bridge a rep. */
export function createRepCounter(){
 let count=0,phase='waiting',standingFrames=0,downFrames=0,startedAt=null,lastTime=null;
 function clearTracking(){phase='waiting';standingFrames=0;downFrames=0;startedAt=null;}
 const result=()=>({count,phase});
 return {
  update(angle,timeMs){
   if(!Number.isFinite(angle)||angle<0||angle>180||!Number.isFinite(timeMs)||timeMs<0){clearTracking();lastTime=null;return result();}
   if(lastTime!==null&&(timeMs<=lastTime||timeMs-lastTime>1000)){clearTracking();lastTime=timeMs;return result();}
   lastTime=timeMs;
   standingFrames=angle>=160?standingFrames+1:0;
   downFrames=angle<=105?downFrames+1:0;
   if(phase==='waiting'){
    if(standingFrames>=3){phase='standing';standingFrames=0;downFrames=0;}
    return result();
   }
   if(phase==='standing'){
    if(angle<160&&startedAt===null)startedAt=timeMs;
    if(angle>=160)startedAt=null;
    if(downFrames>=3){phase='down';standingFrames=0;downFrames=0;}
    return result();
   }
   if(standingFrames>=3){
    if(startedAt!==null&&timeMs-startedAt>=800)count++;
    phase='standing';standingFrames=0;downFrames=0;startedAt=null;
   }
   return result();
  },
  reset(){count=0;lastTime=null;clearTracking();return result();}
 };
}
