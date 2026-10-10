import {createHash} from 'node:crypto';
import {uuid,validatePlan} from './coach.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
export function calendarEvent(plan,userId){
 const p=validatePlan({...plan,start_time:plan.start_time?.slice(0,5)});
 const start=new Date(`${p.scheduled_on}T${p.start_time}:00+09:00`);
 return {id:'cf'+createHash('sha256').update(userId+':'+plan.id).digest('hex'),summary:p.title,
  start:{dateTime:start.toISOString(),timeZone:'Asia/Seoul'},end:{dateTime:new Date(+start+p.minutes*60000).toISOString(),timeZone:'Asia/Seoul'},
  description:'CrewFit에서 저장한 운동 계획',extendedProperties:{private:{crewfitPlan:plan.id,crewfitUser:userId}}};
}
export async function exportPlan(db,user,planId,providerToken,{fetchImpl=fetch}={}){
 if(!uuid(planId))throw fail(400,'올바른 운동 계획이 아니에요.');
 const {data:plan,error}=await db.from('workout_plans').select('*').eq('id',planId).eq('user_id',user.id).maybeSingle();
 if(error)throw fail(503,'운동 계획을 불러오지 못했어요.');if(!plan)throw fail(404,'운동 계획을 찾을 수 없어요.');
 if(typeof providerToken!=='string'||!providerToken||providerToken.length>4096)throw fail(401,'구글 캘린더를 먼저 연결해 주세요.');
 const request=async(url,options={})=>{try{return await fetchImpl(url,{...options,signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+providerToken,'Content-Type':'application/json'}});}catch{throw fail(502,'구글 연결이 지연되고 있어요. 다시 시도해 주세요.');}};
 const identity=await request('https://www.googleapis.com/oauth2/v3/userinfo');
 if(!identity.ok)throw fail(401,'구글 연결이 만료됐어요. 다시 연결해 주세요.');
 const info=await identity.json();
 if(!user.identities?.some(i=>i.provider==='google'&&(i.identity_data?.sub===info.sub||i.id===info.sub)))throw fail(403,'CrewFit에 로그인한 구글 계정과 같은 계정을 연결해 주세요.');
 const event=calendarEvent(plan,user.id),base='https://www.googleapis.com/calendar/v3/calendars/primary/events';
 let response=await request(base+'/'+event.id),saved;
 if(response.status===404){response=await request(base+'?sendUpdates=none',{method:'POST',body:JSON.stringify(event)});if(response.status===409)response=await request(base+'/'+event.id);}
 if(response.status===401)throw fail(401,'구글 연결이 만료됐어요. 다시 연결해 주세요.');
 if(response.status===403)throw fail(403,'캘린더 권한이 없거나 Google Calendar API 설정이 필요해요. 캘린더를 다시 연결해 주세요.');
 if(!response.ok)throw fail(502,'일정을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.');
 saved=await response.json();
 if(saved.status==='cancelled')throw fail(409,'구글에서 삭제한 일정이에요. 캘린더에서 복원하거나 새 운동 계획으로 추가해 주세요.');
 if(saved.id!==event.id||saved.extendedProperties?.private?.crewfitPlan!==plan.id)throw fail(409,'일정 정보를 확인하지 못했어요.');
 const url=new URL(saved.htmlLink||'https://calendar.google.com/');if(!['calendar.google.com','www.google.com'].includes(url.hostname)||url.protocol!=='https:')throw fail(502,'캘린더 링크를 확인하지 못했어요.');
 const record={user_id:user.id,plan_id:plan.id,event_id:event.id,event_url:url.href};
 const stored=await db.from('calendar_exports').upsert(record,{onConflict:'user_id,plan_id',ignoreDuplicates:true});
 if(stored.error)throw fail(503,'구글 일정은 추가됐지만 완료 표시를 저장하지 못했어요. 다시 누르면 중복 없이 확인해요.');
 return record;
}
