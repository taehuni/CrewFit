import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,useLocation} from 'react-router';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {SPORT_LABEL} from '../../shared/ui.jsx';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import PlanCalendar from './PlanCalendar.jsx';
import {CalendarPlanTools} from './CalendarPlans.jsx';
import {fetchWorkoutMonth,workoutDraft} from './workoutPlans.js';
import './saved-plan-editor.css';

export default function SavedWorkoutPlans({selectedDate,onSelect,calendar}){
 const {user,token}=useAuth(),cache=useQueryClient(),location=useLocation();
 const [month,setMonth]=useState(selectedDate.slice(0,7)),[editing,setEditing]=useState(null),[draft,setDraft]=useState(null),[discard,setDiscard]=useState(false),[deleting,setDeleting]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false),dirty=useRef(false),editor=useRef(null);
 dirty.current=!!draft&&(!editing||JSON.stringify(draft)!==JSON.stringify(workoutDraft(editing)));
 const guard=useLeaveGuard(()=>dirty.current||lock.current,'저장하지 않은 계획 수정 내용이 있어요. 나가면 사라져요.');
 useEffect(()=>{setMonth(selectedDate.slice(0,7));setDraft(null);setEditing(null);setDiscard(false);dirty.current=false;},[selectedDate]);
 const query=useQuery({queryKey:['workout-plans',user.id,month],queryFn:({signal})=>fetchWorkoutMonth((path,options)=>api(path,{token,...options}),month,signal),retry:false});
 const plans=query.data||[],dayPlans=plans.filter(plan=>plan.scheduled_on===selectedDate);
 function close(){setDraft(null);setEditing(null);setDiscard(false);dirty.current=false;}
 function add(){setEditing(null);setDraft({id:crypto.randomUUID(),title:'',sport:'walking',scheduled_on:selectedDate,start_time:'19:00',minutes:30,note:''});setError('');setNotice('');requestAnimationFrame(()=>editor.current?.querySelector('input')?.focus());}
 function edit(plan){setEditing(plan);setDraft(workoutDraft(plan));setError('');setNotice('');setDiscard(false);requestAnimationFrame(()=>editor.current?.querySelector('input')?.focus());}
 const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
 async function refresh(){await Promise.all([cache.invalidateQueries({queryKey:['workout-plans',user.id]}),cache.invalidateQueries({queryKey:['coach',user.id]}),cache.invalidateQueries({queryKey:['coach-history',user.id]})]);}
 async function save(event){
  event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const creating=!editing;const saved=await api(creating?'/coach/plans/manual':'/coach/plans/'+editing.id,{token,method:creating?'POST':'PUT',body:draft});close();await refresh();lock.current=false;onSelect(saved.scheduled_on);setNotice(creating?'운동 계획을 추가했어요.':'계획을 수정했어요. 구글 캘린더에 추가한 일정은 따로 수정해 주세요.');}
  catch(err){setError(err.message);}
  finally{lock.current=false;setBusy(false);}
 }
 async function remove(id){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await api('/coach/plans/'+id,{token,method:'DELETE'});setDeleting(null);await refresh();setNotice('계획을 삭제했어요. 구글 일정과 운동 기록은 유지돼요.');}
  catch(err){setError(err.message);}finally{lock.current=false;setBusy(false);}
 }
 return <>{guard}<span className="section-eyebrow">MY PLAN</span><h2>날짜별 일정</h2><p className="muted small">날짜를 누르면 그날의 계획을 보고 수정할 수 있어요.</p>
 {query.isSuccess&&!draft&&<CalendarPlanTools plans={dayPlans} calendar={calendar} date={selectedDate}/>}
 <div className="saved-plan-layout"><div className="saved-plan-calendar"><fieldset className="saved-plan-calendar-controls" disabled={!!draft||busy}><PlanCalendar plans={plans} selected={selectedDate} onSelect={onSelect} month={month} onMonthChange={next=>{setMonth(next);onSelect(next+'-01');}}/></fieldset>{draft&&<p className="muted small">수정을 저장하거나 취소하면 다른 날짜를 볼 수 있어요.</p>}</div>
 <div className="saved-plan-day"><div className="plan-day-heading"><h3>{Number(selectedDate.slice(5,7))}월 {Number(selectedDate.slice(8))}일</h3><span>{dayPlans.length}개 계획</span><button type="button" className="btn btn-primary" disabled={!!draft||busy} onClick={add}>계획 추가</button></div>
 {location.state?.recordedPlanId&&<p className="saved-plan-success" role="status">운동 기록을 저장했어요. <Link to={'/activities/'+location.state.recordedActivityId}>저장한 기록 보기</Link></p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 {query.isPending&&<p role="status">이달의 계획을 모두 불러오고 있어요.</p>}{query.isError&&<div role="alert"><p>계획을 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 시도</button></div>}
 {draft&&<form className="saved-plan-editor" onSubmit={save} ref={editor}><h3>{editing?'계획 수정':'운동 계획 추가'}</h3><fieldset disabled={busy}>
 <label>운동 이름<input required maxLength={100} value={draft.title} onChange={e=>change('title',e.target.value)}/></label>
 <div className="saved-plan-editor-fields"><label>종목<select value={draft.sport} onChange={e=>change('sport',e.target.value)}>{Object.entries(SPORT_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>운동 시간 · 분<input type="number" required min={5} max={240} step={1} value={draft.minutes} onChange={e=>change('minutes',e.target.value===''?'':Number(e.target.value))}/></label><label>날짜<input type="date" required min="2000-01-01" max="2100-12-31" value={draft.scheduled_on} onChange={e=>change('scheduled_on',e.target.value)}/></label><label>시작 시각<input type="time" required value={draft.start_time} onChange={e=>change('start_time',e.target.value)}/></label></div>
 <label>운동 내용·메모<textarea rows={5} maxLength={1000} value={draft.note} onChange={e=>change('note',e.target.value)}/></label><small>한국시간 기준 · CrewFit 계획만 수정해요. 이미 추가한 구글 일정은 자동으로 바뀌지 않아요.</small>
 <div className="saved-plan-editor-actions"><button className="btn btn-primary" disabled={!dirty.current}>{busy?'저장 중…':editing?'수정 저장':'계획 저장'}</button><button type="button" className="btn btn-ghost" onClick={()=>dirty.current?setDiscard(true):close()}>취소</button></div>
 {discard&&<div role="alert"><p>수정한 내용을 버릴까요?</p><button type="button" className="btn btn-ghost" onClick={close}>수정 내용 버리기</button><button type="button" className="btn btn-primary" onClick={()=>setDiscard(false)}>계속 수정</button></div>}
 </fieldset></form>}
 {query.isSuccess&&!dayPlans.length&&!draft&&<div className="plan-day-empty"><strong>이날은 비워 둔 날이에요</strong><p>정해 둔 운동이 있다면 계획을 추가하세요. 추천이 필요하면 코칭 대화에서 도움을 받을 수 있어요.</p></div>}
 {dayPlans.map(plan=><article key={plan.id}><div className="coach-saved-plan-top"><time dateTime={plan.scheduled_on+'T'+plan.start_time.slice(0,5)+'+09:00'}>{plan.start_time.slice(0,5)}<span>시작</span></time><div className="coach-saved-plan-meta"><span>{SPORT_LABEL[plan.sport]}</span><span>{plan.minutes}분</span></div></div><h3>{plan.title}</h3>{plan.activity_id&&<p className="saved-plan-complete">✓ 기록 완료</p>}{plan.completion_available===false&&<p className="muted small" role="status">기록 완료 여부를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.</p>}{plan.note?.trim()&&<div className="coach-plan-notes"><strong>운동 안내</strong><div>{plan.note.split(/\r?\n/).filter(line=>line.trim()).map((line,index)=><p key={index}>{line}</p>)}</div></div>}
 <div className="saved-plan-actions"><button className="btn btn-primary" disabled={!!draft||busy} onClick={()=>edit(plan)}>계획 수정</button>{plan.activity_id?<Link className="btn btn-ghost saved-plan-record" to={'/activities/'+plan.activity_id}>기록 보기</Link>:<Link className="btn btn-ghost saved-plan-record" to={'/activities/new?sport='+plan.sport} state={{workoutPlan:plan,planOwnerId:user.id,returnTo:'/coach?view=plans&date='+selectedDate}}>운동 기록하기</Link>}<div className="plan-delete-footer">{deleting===plan.id?<div className="plan-delete-confirm"><p>저장한 계획을 삭제할까요?<small>이미 기록한 운동과 구글 일정은 유지돼요.</small></p><div><button className="btn btn-ghost" disabled={busy||!!draft} onClick={()=>remove(plan.id)}>삭제 확인</button><button className="btn btn-ghost" disabled={busy} onClick={()=>setDeleting(null)}>취소</button></div></div>:<button className="btn btn-ghost coach-delete" disabled={!!draft||busy} onClick={()=>setDeleting(plan.id)}>계획 삭제</button>}</div></div></article>)}
 </div></div><Link className="coach-meal-plans-link" to="/meals?view=plans"><span>식단 계획</span><small>저장한 끼니 확인하기 →</small></Link><p className="muted small">한국시간 기준 · 월별 전체 계획<br/>앱의 계획을 수정하거나 삭제해도 구글 일정은 유지돼요.</p></>;
}
