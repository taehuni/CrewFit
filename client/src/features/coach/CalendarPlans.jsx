import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {Link} from 'react-router';
import {api} from '../../shared/api.js';
export function useCalendarPlans(){
 const {user,token,session}=useAuth(),cache=useQueryClient(),lock=useRef(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(null),[confirm,setConfirm]=useState(null);
 const exports=useQuery({queryKey:['calendar-exports',user.id],queryFn:()=>api('/calendar/exports',{token}),retry:false});
 async function add(plan){if(lock.current)return;lock.current=true;setBusy(plan.id);setError('');
  try{await api('/calendar/plans/'+plan.id,{token,body:{providerToken:session?.provider_token}});await cache.invalidateQueries({queryKey:['calendar-exports',user.id]});setConfirm(null);}catch(e){setError(e.message);}finally{lock.current=false;setBusy(null);}
 }
 return {exports,error,busy,confirm,setConfirm,add,hasToken:!!session?.provider_token};
}
export function CalendarPlanAction({plan,calendar}){
 const saved=calendar.exports.data?.find(row=>row.plan_id===plan.id);
 if(!calendar.hasToken&&!saved)return <Link className="calendar-settings-link" to="/me?calendar=settings#profile-connections">캘린더 연결 설정 ↗</Link>;
 if(saved)return <a className="calendar-added" href={saved.event_url} target="_blank" rel="noreferrer">✓ 캘린더에 추가됨 · 열기 ↗</a>;
 return <div className="calendar-action">{calendar.confirm===plan.id?<div><p>{plan.scheduled_on} {plan.start_time.slice(0,5)} · {plan.minutes}분<br/>이 계획을 구글 캘린더에 추가할까요?</p><button className="btn btn-primary" disabled={!!calendar.busy} onClick={()=>calendar.add(plan)}>{calendar.busy===plan.id?'추가 중…':'일정 추가 확인'}</button><button className="btn btn-ghost" disabled={!!calendar.busy} onClick={()=>calendar.setConfirm(null)}>취소</button></div>:<button className="btn btn-ghost" disabled={!!calendar.busy} onClick={()=>calendar.setConfirm(plan.id)}>구글 캘린더에 추가</button>}</div>;
}

