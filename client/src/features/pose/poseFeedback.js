// Product heuristics awaiting real-device validation, not clinical thresholds.
// A single 2D side view cannot determine foot contact, joint load or exercise safety.
const FOOT={left:{heel:29,toe:31},right:{heel:30,toe:32}};
function visible(point,threshold){return !!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.visibility)&&point.visibility>=threshold&&point.x>=.03&&point.x<=.97&&point.y>=.03&&point.y<=.97;}
const item=(key,label,state,message)=>({key,label,state,message});
const unknown=(key,label,message)=>item(key,label,'unknown',message);
function empty(summary){return {ready:false,items:[unknown('heel','뒤꿈치','발의 위치를 확인할 수 없어요.'),unknown('torso','상체 기울기','기준 자세를 먼저 확인해 주세요.'),unknown('depth','무릎 각도','각도를 확인할 수 없어요.')],summary};}

export function createFormFeedback(){
 let side=null,lastTime=null,samples=[],baseline=null,heelHigh=0,heelLow=0,torsoHigh=0,torsoLow=0;
 function clear(){side=null;samples=[];baseline=null;heelHigh=heelLow=torsoHigh=torsoLow=0;}
 function reset(){clear();lastTime=null;return empty('옆으로 서서 전신과 발이 보이도록 준비해 주세요.');}
 return {reset,update(pose,landmarks,width,height,timeMs){
  if(!Number.isFinite(timeMs)||timeMs<0||!pose?.valid||!FOOT[pose.side]||!Number.isFinite(pose.angle)||pose.angle<0||pose.angle>180||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){reset();return empty('추적이 끊겼어요. 옆으로 서서 기준 자세를 다시 확인해 주세요.');}
  if(lastTime!==null&&(timeMs<=lastTime||timeMs-lastTime>700)){clear();lastTime=timeMs;return empty('화면이 잠시 끊겼어요. 서 있는 자세부터 다시 확인해 주세요.');}
  lastTime=timeMs;
  if(side!==null&&side!==pose.side){clear();side=pose.side;return empty('측정하는 쪽이 바뀌었어요. 서 있는 자세부터 다시 확인해 주세요.');}
  side=pose.side;
  const shoulder=pose.points?.shoulder,hip=pose.points?.hip;
  if(![shoulder?.x,shoulder?.y,hip?.x,hip?.y].every(Number.isFinite)){clear();return empty('상체 위치를 확인할 수 없어요. 전신이 보이도록 서 주세요.');}
  const torsoLength=Math.hypot(shoulder.x-hip.x,shoulder.y-hip.y);
  if(torsoLength<1){clear();return empty('상체 위치를 확인할 수 없어요.');}
  // Only gate when both shoulders are visible; the far shoulder can be occluded in a true side view.
  const left=landmarks?.[11],right=landmarks?.[12];
  if(visible(left,.65)&&visible(right,.65)&&Math.abs(left.x-right.x)*width/torsoLength>.45){clear();return empty('정면에서는 이 항목을 비교하기 어려워요. 몸을 옆으로 돌려 주세요.');}
  const torso=Math.abs(Math.atan2(shoulder.x-hip.x,hip.y-shoulder.y)*180/Math.PI);
  const heel=landmarks?.[FOOT[side].heel],toe=landmarks?.[FOOT[side].toe];
  let relativeHeel=null;
  if(visible(heel,.7)&&visible(toe,.7)){
   const length=Math.hypot((toe.x-heel.x)*width,(toe.y-heel.y)*height);
   if(length>=1)relativeHeel=(toe.y-heel.y)*height/length;
  }
  const depth=item('depth','무릎 각도','observe',Math.round(pose.angle)+'°로 관찰돼요. 각도만으로 자세의 안전성을 판단할 수 없어요.');
  if(!baseline){
   if(pose.angle>=160&&relativeHeel!==null){samples.push({heel:relativeHeel,torso});}
   else samples=[];
   if(samples.length<12)return {ready:false,items:[unknown('heel','뒤꿈치','발 전체가 보이도록 서 주세요.'),unknown('torso','상체 기울기','서 있는 자세를 기준으로 비교할 준비 중이에요.'),depth],summary:'서 있는 자세를 유지해 주세요. 기준 자세 확인 '+samples.length+'/12'};
   baseline={heel:samples.reduce((sum,p)=>sum+p.heel,0)/samples.length,torso:samples.reduce((sum,p)=>sum+p.torso,0)/samples.length};samples=[];
  }
  if(pose.angle>=145){heelHigh=heelLow=torsoHigh=torsoLow=0;return {ready:true,items:[unknown('heel','뒤꿈치','무릎을 굽히는 동안 발의 변화를 살펴봐요.'),unknown('torso','상체 기울기','무릎을 굽히는 동안 기준 자세와 비교해요.'),depth],summary:'기준 자세를 확인했어요. 편안한 범위에서 움직여 보세요.'};}
  let heelItem;
  if(relativeHeel===null){heelHigh=heelLow=0;heelItem=unknown('heel','뒤꿈치','발이 가려져 있어요. 뒤꿈치와 발끝이 보이는지 확인해 주세요.');}
  else{
   const high=relativeHeel-baseline.heel>.18;heelHigh=high?heelHigh+1:0;heelLow=high?0:heelLow+1;
   heelItem=heelHigh>=5?item('heel','뒤꿈치','observe','뒤꿈치가 들리는 모습이 반복돼요. 발바닥 접촉을 확인해 주세요.'):heelLow>=5?item('heel','뒤꿈치','steady','뚜렷한 들림 신호는 관찰되지 않았어요.'):unknown('heel','뒤꿈치','몇 프레임 더 관찰하고 있어요.');
  }
  const leaning=torso-baseline.torso>45&&torso>55;torsoHigh=leaning?torsoHigh+1:0;torsoLow=leaning?0:torsoLow+1;
  const torsoItem=torsoHigh>=5?item('torso','상체 기울기','observe','기준 자세보다 상체 기울기가 크게 늘어난 모습이 반복돼요. 체형과 동작에 따라 달라지며, 앞으로 기울이는 것 자체가 오류는 아니에요.'):torsoLow>=5?item('torso','상체 기울기','steady','기준 대비 큰 기울기 증가 신호는 관찰되지 않았어요.'):unknown('torso','상체 기울기','몇 프레임 더 관찰하고 있어요.');
  return {ready:true,items:[heelItem,torsoItem,depth],summary:heelHigh>=5||torsoHigh>=5?'반복해서 보이는 움직임을 확인해 보세요. 2D 관찰이며 자세의 안전성을 판정하지 않아요.':'관찰 중이에요. 화면에 보이는 변화만 참고해 주세요.'};
 }};
}
