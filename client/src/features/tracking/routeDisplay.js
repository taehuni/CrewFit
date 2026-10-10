import {routeSegments,distanceBetween} from './tracking.js';

// Simplify only the displayed line, within 8m of retained segments. Raw fixes and
// recorded distance stay unchanged; never bridge a missing-signal interval.
export function displaySegments(points,tolerance=8){
  if(!Number.isFinite(tolerance)||tolerance<0)throw new Error('invalid tolerance');
  return routeSegments(points).map(segment=>{
    if(segment.length<3||tolerance===0)return segment;
    const origin=segment[0],scale=111195,cos=Math.cos(origin[0]*Math.PI/180);
    const xy=segment.map(p=>[(p[1]-origin[1])*scale*cos,(p[0]-origin[0])*scale]);
    const keep=new Set([0,segment.length-1]),stack=[[0,segment.length-1]];
    while(stack.length){const [a,b]=stack.pop(),[x,y]=xy[a],dx=xy[b][0]-x,dy=xy[b][1]-y,length=dx*dx+dy*dy;let far=-1,max=tolerance*tolerance;
      for(let i=a+1;i<b;i++){const t=length?Math.max(0,Math.min(1,((xy[i][0]-x)*dx+(xy[i][1]-y)*dy)/length)):0;const d=(xy[i][0]-x-t*dx)**2+(xy[i][1]-y-t*dy)**2;if(d>max){max=d;far=i;}}
      if(far!==-1){keep.add(far);stack.push([a,far],[far,b]);}
    }
    return [...keep].sort((a,b)=>a-b).map(i=>segment[i]);
  });
}

export function roundedDisplaySegments(points){
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  return displaySegments(points).map(segment=>{
    if(segment.length<3)return segment;
    const result=[segment[0]];
    for(let i=1;i<segment.length-1;i++){
      const a=segment[i-1],b=segment[i],c=segment[i+1],before=distanceBetween(a,b),after=distanceBetween(b,c);
      if(!before||!after){result.push(b);continue;}
      const radius=Math.min(4,before*.2,after*.2),entry=mix(b,a,radius/before),exit=mix(b,c,radius/after);
      result.push(entry);
      for(let step=1;step<=6;step++){const t=step/6;result.push(mix(mix(entry,b,t),mix(b,exit,t),t));}
    }
    result.push(segment.at(-1));return result;
  });
}
