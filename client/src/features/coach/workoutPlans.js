export async function fetchPlanMonth(request,month,signal,path='/coach/plans'){
 const rows=new Map();let cursor=null;
 do {
  const page=await request(path+'?month='+encodeURIComponent(month)+(cursor?'&cursor='+encodeURIComponent(cursor):''),{signal});
  for(const plan of page.plans)rows.set(plan.id,plan);
  if(page.nextCursor===cursor&&cursor)throw new Error('계획을 모두 불러오지 못했어요. 다시 시도해 주세요.');
  cursor=page.nextCursor;
 }while(cursor);
 return [...rows.values()].sort((a,b)=>a.scheduled_on.localeCompare(b.scheduled_on)||(a.start_time||a.meal_type||'').localeCompare(b.start_time||b.meal_type||'')||a.id.localeCompare(b.id));
}
export const fetchWorkoutMonth=(request,month,signal)=>fetchPlanMonth(request,month,signal);
export function workoutDraft(plan){return Object.fromEntries(['title','sport','scheduled_on','start_time','minutes','note'].map(key=>[key,key==='start_time'?plan[key].slice(0,5):plan[key]]));}
