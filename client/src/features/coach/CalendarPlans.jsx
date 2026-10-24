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
 if(!calendar.hasToken&&!saved)return <Link className="btn btn-ghost calendar-settings-link" to="/me/settings?calendar=settings#profile-connections">캘린더 연결 설정 ↗</Link>;
 if(saved)return <a className="btn btn-ghost calendar-added" href={saved.event_url} target="_blank" rel="noreferrer">✓ 캘린더에 추가됨 · 열기 ↗</a>;
 return <div className="calendar-action">{calendar.confirm===plan.id?<div><p>{plan.scheduled_on} {plan.start_time.slice(0,5)} · {plan.minutes}분<br/>이 계획을 구글 캘린더에 추가할까요?</p><button className="btn btn-primary" disabled={!!calendar.busy} onClick={()=>calendar.add(plan)}>{calendar.busy===plan.id?'추가 중…':'일정 추가 확인'}</button><button className="btn btn-ghost" disabled={!!calendar.busy} onClick={()=>calendar.setConfirm(null)}>취소</button></div>:<button className="btn btn-ghost" disabled={!!calendar.busy} onClick={()=>calendar.setConfirm(plan.id)}>구글 캘린더에 추가</button>}</div>;
}


export function CalendarPlanTools({plans,calendar,date}){
 const [open,setOpen]=useState(false);
 return <div className="calendar-plan-tools"><button type="button" className="btn btn-ghost" aria-expanded={open} onClick={()=>setOpen(!open)}>구글 캘린더에 추가하기 <span aria-hidden="true">{open?'−':'+'}</span></button>{open&&<section className="calendar-export-panel" aria-label="구글 캘린더에 계획 추가"><h3>{date}의 계획</h3><p>달력에서 날짜를 고른 뒤, 추가할 계획을 확인해 주세요.</p>{calendar.exports.isPending?<p role="status">추가 내역을 확인하고 있어요.</p>:calendar.exports.isError?<button type="button" onClick={()=>calendar.exports.refetch()}>추가 내역 다시 확인</button>:!calendar.hasToken?<><p>먼저 구글 계정을 연결해 주세요. 연결만으로 일정이 추가되지는 않아요.</p><Link className="btn btn-primary" to="/me/settings?calendar=settings#profile-connections">구글 캘린더 연결</Link></>:!plans.length?<p>선택한 날짜에는 저장한 계획이 없어요.</p>:plans.map(plan=><div className="calendar-export-item" key={plan.id}><strong>{plan.start_time.slice(0,5)} · {plan.title}</strong><CalendarPlanAction plan={plan} calendar={calendar}/></div>)}{calendar.error&&<p role="alert">{calendar.error}</p>}</section>}</div>;
}
