import useUnsavedForm from '../../shared/useUnsavedForm.js';
import {fetchPlanMonth} from './workoutPlans.js';
import PlanCalendar from './PlanCalendar.jsx';
import {koreaToday} from '../../shared/calendar.js';
import './saved-plan-editor.css';
import './plan-delete.css';
import {useRef,useState,useId} from 'react';
import {Link} from 'react-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import './nutrition.css';
import './nutrition-proposals.css';
const labels={breakfast:'아침',lunch:'점심',dinner:'저녁',snack:'간식'};
export function useNutrition(turnId){const {user,token}=useAuth();return useQuery({queryKey:['nutrition',user.id,turnId||'preferences'],queryFn:()=>api('/coach/nutrition'+(turnId?'?turn_id='+encodeURIComponent(turnId):''),{token}),retry:false});}
function PreferencesForm({initial}){
 const {user,token}=useAuth(),cache=useQueryClient(),lock=useRef(false);const [form,setForm]=useState(initial||{goal:'balanced',allergies:'',avoid:'',preference:''}),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const {leaveGuard,markSaved}=useUnsavedForm(form);
 async function save(e){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await api('/coach/nutrition',{token,method:'PUT',body:form});markSaved();await cache.invalidateQueries({queryKey:['nutrition',user.id]});setNotice('식사 선호를 저장했어요. 다음 메시지부터 코치가 참고해요.');}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return <form className="nutrition-preferences" onSubmit={save}>{leaveGuard}<span className="section-eyebrow">MY FOOD ROUTINE</span><h3>어떤 식사를 하고 싶어요?</h3><p>본인만 볼 수 있어요. 저장한 선호는 메시지를 보낼 때 AI가 참고해요.</p><fieldset disabled={busy}><label>식사 목표<select value={form.goal} onChange={e=>setForm({...form,goal:e.target.value})}>{[['balanced','균형 잡힌 식사'],['fitness','체력 향상'],['muscle','근육 증가'],['weight','체중 관리']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>{[['allergies','알레르기','없다면 ‘없음’, 있다면 땅콩·우유 등'],['avoid','피하고 싶은 음식','예: 생선, 매운 음식'],['preference','식사 선호·준비 여건','예: 채식 위주, 조리 15분, 외식이 잦아요']].map(([key,title,placeholder])=><label key={key}>{title}<input maxLength={300} value={form[key]} placeholder={placeholder} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<button className="btn btn-ghost" disabled={busy}>{busy?'저장 중…':'식사 선호 저장'}</button></fieldset><p role="status">{notice}</p>{error&&<p role="alert">{error}</p>}</form>;
}
export function NutritionPreferences(){const query=useNutrition();if(query.isPending)return <p role="status">식사 선호를 불러오는 중…</p>;if(query.isError)return <p role="alert">식단 코치 설정을 불러오지 못했어요. <button onClick={()=>query.refetch()}>다시 시도</button></p>;return <PreferencesForm initial={query.data.preferences}/>;}
function Foods({plan}){return <><ul className="nutrition-foods">{plan.items.map((item,i)=><li key={i}><strong>{item.name}</strong><span>{item.amount}</span>{item.alternative&&<small>대체 아이디어 · {item.alternative}</small>}</li>)}</ul>{plan.note&&<p className="nutrition-note">{plan.note}</p>}<p className="nutrition-caution">AI가 제안한 구성으로, 영양성분을 검증한 식단은 아니에요. 알레르기가 있다면 제품의 원재료 표시도 확인해 주세요.</p></>;}
function IngredientLinks({plan}) {
 const names=[...new Set(plan.items.map(item=>item.name).filter(Boolean))];
 return <div className="nutrition-shopping"><strong>필요한 식품 찾아보기</strong><p>준비할 음식의 상품 정보와 가격을 살펴보세요.</p><div>{names.map(name=><Link key={name} to={'/store?source=meal&q='+encodeURIComponent(name)}>{name} <span aria-hidden="true">↗</span></Link>)}</div></div>;
}
function PlanHeading({plan}) {
 return <div className="nutrition-plan-heading"><span className="nutrition-meal-badge">{labels[plan.meal_type]}</span><time dateTime={plan.scheduled_on}>{plan.scheduled_on}</time></div>;
}
export function MealProposals({turn}){
 const query=useNutrition(turn.id),{user,token}=useAuth(),cache=useQueryClient(),lock=useRef(false);
 const [busy,setBusy]=useState(null),[error,setError]=useState(''),[activePosition,setActivePosition]=useState(0);
 const detailId=useId();
 async function save(position){if(lock.current)return;lock.current=true;setBusy(position);setError('');try{await api('/coach/meal-plans',{token,body:{turn_id:turn.id,position}});await Promise.all([cache.invalidateQueries({queryKey:['nutrition',user.id]}),cache.invalidateQueries({queryKey:['meal-plans',user.id]})]);}catch(e){setError('끼니 '+(position+1)+' 저장: '+e.message);}finally{lock.current=false;setBusy(null);}}
 if(!turn.meal_proposals?.length)return null;
 const position=activePosition<turn.meal_proposals.length?activePosition:0;
 const plan=turn.meal_proposals[position];
 const savedAt=index=>query.data?.plans.find(p=>p.turn_id===turn.id&&p.position===index);
 const saved=savedAt(position);
 return <section className="nutrition-proposals nutrition-proposal-review">
  <div className="nutrition-proposal-heading"><h3>제안받은 식단</h3><span>{turn.meal_proposals.length}개 끼니</span></div>
  <p>끼니를 선택해 구성을 확인하고, 마음에 드는 계획을 저장하세요.</p>
  <div className="nutrition-proposal-options" role="group" aria-label="제안된 끼니 선택">{turn.meal_proposals.map((item,index)=><button type="button" key={index} disabled={busy!==null} aria-pressed={position===index} aria-controls={detailId} onClick={()=>setActivePosition(index)}><span>{item.scheduled_on} · {labels[item.meal_type]}{savedAt(index)&&<em>저장됨</em>}</span><strong>{item.title}</strong></button>)}</div>
  {query.isPending&&<p role="status">식단 저장 내역을 확인하고 있어요.</p>}
  {query.isError&&<p role="alert">저장 내역을 불러오지 못했어요. <button type="button" onClick={()=>query.refetch()}>다시 확인</button></p>}
  <article className="nutrition-plan nutrition-proposal-detail" id={detailId}>
   <PlanHeading plan={plan}/><h4>{plan.title}</h4><Foods plan={plan}/>
   {error&&<p role="alert">{error}</p>}
   {saved?<p role="status">식단 계획에 저장했어요. <Link to="/meals?view=plans">저장한 계획 보기 ↗</Link> · <Link to={'/meals/new?plan='+saved.id}>먹은 식단으로 기록 ↗</Link></p>:<button type="button" className="btn btn-primary" disabled={busy!==null||!query.isSuccess} onClick={()=>save(position)}>{busy===position?'저장 중…':'이 끼니를 식단 계획에 저장'}</button>}
   <IngredientLinks plan={plan}/>
  </article>
 </section>;
}
export function SavedMealPlans(){
 const {user,token}=useAuth(),cache=useQueryClient(),lock=useRef(false);
 const [date,setDate]=useState(koreaToday()),[confirm,setConfirm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const month=date.slice(0,7);
 const query=useQuery({queryKey:['meal-plans',user.id,month],queryFn:({signal})=>fetchPlanMonth((path,options)=>api(path,{token,...options}),month,signal,'/coach/meal-plans'),retry:false});
 const plans=query.data||[],dayPlans=plans.filter(plan=>plan.scheduled_on===date).sort((a,b)=>Object.keys(labels).indexOf(a.meal_type)-Object.keys(labels).indexOf(b.meal_type));
 async function remove(id){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await api('/coach/meal-plans/'+id,{token,method:'DELETE'});await Promise.all([cache.invalidateQueries({queryKey:['nutrition',user.id]}),cache.invalidateQueries({queryKey:['meal-plans',user.id]})]);setConfirm(null);}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return <section className="nutrition-saved"><h2>저장한 식단 계획</h2><p className="muted small">날짜를 선택해 그날의 끼니를 확인하세요. 계획을 지워도 먹은 기록은 유지돼요.</p>
 <div className="saved-plan-layout"><div className="saved-plan-calendar"><PlanCalendar label="식단 계획" plans={plans} selected={date} onSelect={setDate} month={month} onMonthChange={next=>setDate(next+'-01')}/></div><div className="saved-plan-day"><div className="plan-day-heading"><h3>{Number(date.slice(5,7))}월 {Number(date.slice(8))}일</h3><span>{dayPlans.length}개 끼니</span></div>
 {query.isPending?<p role="status">이달의 식단 계획을 불러오는 중…</p>:query.isError?<p role="alert">계획을 불러오지 못했어요. <button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 시도</button></p>:!dayPlans.length?<div className="plan-day-empty"><strong>이날 저장한 식단이 없어요</strong><p>점이 있는 날짜를 선택하거나 코칭 대화에서 끼니를 제안받아 보세요.</p><Link className="btn btn-ghost" to="/coach?view=chat">식단 상담하기</Link></div>:<div className="nutrition-plan-grid nutrition-day-plans">{dayPlans.map(plan=><article className="nutrition-saved-card" key={plan.id}><PlanHeading plan={plan}/><h3>{plan.title}</h3><Foods plan={plan}/><Link className="btn btn-primary" to={'/meals/new?plan='+plan.id}>먹은 식단으로 기록</Link><IngredientLinks plan={plan}/><div className="plan-delete-footer">{confirm===plan.id?<div className="plan-delete-confirm"><p>이 식단 계획을 삭제할까요?<small>이미 기록한 식사는 유지돼요.</small></p><div><button className="btn btn-ghost" disabled={busy} onClick={()=>remove(plan.id)}>삭제 확인</button><button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirm(null)}>취소</button></div></div>:<button className="btn btn-ghost coach-delete" disabled={busy} onClick={()=>setConfirm(plan.id)}>계획 삭제</button>}</div></article>)}</div>}{error&&<p role="alert">{error}</p>}</div></div></section>;
}
