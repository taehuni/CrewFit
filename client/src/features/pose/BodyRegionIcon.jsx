import {anteriorData,posteriorData} from './vendor/react-body-highlighter/body-model.js';

const REGION_MUSCLES={
 all:[],
 lower:['abductors','quadriceps','calves','adductor','hamstring','gluteal','left-soleus','right-soleus'],
 back:['trapezius','upper-back','lower-back'],
 chest:['chest'],
 shoulders:['front-deltoids','back-deltoids'],
 arms:['biceps','triceps','forearm'],
 core:['abs','obliques'],
 full:['chest','front-deltoids','back-deltoids','biceps','triceps','forearm','abs','obliques','abductors','quadriceps','calves','adductor','hamstring','gluteal','trapezius','upper-back','lower-back','left-soleus','right-soleus'],
};

// Decorative body art: the enclosing button or exercise name provides its label.
export default function BodyRegionIcon({region='all',className}){
 const muscles=REGION_MUSCLES[region]||REGION_MUSCLES.all;
 const posterior=region==='back';
 const model=posterior?posteriorData:anteriorData;
 const viewBox=region==='lower'||region==='full'?'0 -24 1000 2048':posterior?'0 -24 1000 1284':'0 -24 1000 1224';
 return <svg
  className={className}
  xmlns="http://www.w3.org/2000/svg"
  viewBox={viewBox}
  preserveAspectRatio="xMidYMid meet"
  width="100%"
  height="100%"
  style={{display:'block',minWidth:0,minHeight:0,pointerEvents:'none'}}
  aria-hidden="true"
  focusable="false"
 >
  {model.map(({muscle,svgPoints})=><g key={muscle} fill={muscles.includes(muscle)?'var(--pose-body-highlight, #245c43)':'var(--pose-body-neutral, #d4d7d5)'}>
   {svgPoints.map((points,index)=><polygon key={index} points={points}/>)}
  </g>)}
 </svg>;
}
