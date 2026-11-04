import ConversationPlanRequest from './ConversationPlanRequest.jsx';
import './plan-delete.css';
import CoachHistory from './CoachHistory.jsx';
import {starterContext,proposalWeek} from './starterPlan.js';
import PlanCalendar from './PlanCalendar.jsx';
import {koreaToday} from './planCalendar.js';
import {persistWorkoutPlans} from './planSaving.js';
import {NutritionPreferences,MealProposals} from './NutritionCoach.jsx';
import {useCalendarPlans,CalendarPlanTools} from './CalendarPlans.jsx';
import {useRef,useState,useEffect,useId} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router';
import {coachRouteState} from './coachRoute.js';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {SPORT_LABEL} from '../../shared/ui.jsx';
import './coach.css';
import './proposal-review.css';
export function Proposal({turn,plans,onSave,onViewPlans}){
 const [items,setItems]=useState(()=>turn.proposals.map((p,position)=>({...p,position,selected:true})));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[savedNotice,setSavedNotice]=useState('');
 const [activePosition,setActivePosition]=useState(0),[activeWeek,setActiveWeek]=useState(1);
 const saveLock=useRef(false),editor=useRef(null),editorId=useId();
 const context=starterContext(turn.message);
 // Keep the generated week grouping stable while a date is being edited.
 const weekOf=p=>context?proposalWeek(turn.proposals[p.position].scheduled_on,context.date):1;
 const weeks=[...new Set(items.map(weekOf))].sort((a,b)=>a-b);
 const currentWeek=weeks.includes(activeWeek)?activeWeek:weeks[0];
 const visible=items.filter(p=>!context||weekOf(p)===currentWeek);
 const active=visible.find(p=>p.position===activePosition)||visible[0];
 const saved=new Set(plans.filter(p=>p.turn_id===turn.id).map(p=>p.position));
 const selected=items.filter(p=>p.selected&&!saved.has(p.position));
 const currentSelected=visible.filter(p=>p.selected&&!saved.has(p.position)).length;
 const change=(position,key,value)=>setItems(rows=>rows.map(row=>row.position===position?{...row,[key]:value}:row));
 const selectWeek=week=>setItems(rows=>rows.map(p=>saved.has(p.position)?p:{...p,selected:week===null||weekOf(p)===week}));
 const chooseWeek=week=>{setActiveWeek(week);setActivePosition(items.find(p=>weekOf(p)===week)?.position??0);};
 function invalid(item){
  const date=new Date(item.scheduled_on+'T00:00:00Z');
  return !item.title?.trim()||item.title.length>100||!Object.hasOwn(SPORT_LABEL,item.sport)||
   !/^\d{4}-\d{2}-\d{2}$/.test(item.scheduled_on)||!Number.isFinite(date.getTime())||
   date.toISOString().slice(0,10)!==item.scheduled_on||item.scheduled_on<'2000-01-01'||item.scheduled_on>'2100-12-31'||
   !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start_time)||!Number.isInteger(item.minutes)||item.minutes<5||item.minutes>240||
   typeof item.note!=='string'||item.note.length>1000;
 }
 async function submit(e){
  e.preventDefault();if(saveLock.current||!selected.length)return;
  setError('');setSavedNotice('');
  const firstInvalid=selected.find(invalid);
  if(firstInvalid){
   setActiveWeek(weekOf(firstInvalid));setActivePosition(firstInvalid.position);
   setError('일정 '+(firstInvalid.position+1)+'의 이름·날짜·시각을 확인해 주세요. 운동 시간은 5~240분으로 입력해 주세요.');
   requestAnimationFrame(()=>{editor.current?.scrollIntoView({block:'nearest'});(editor.current?.querySelector('input:invalid,select:invalid,textarea:invalid')||editor.current?.querySelector('input'))?.focus();});
   return;
  }
  saveLock.current=true;setBusy(true);
  try{await onSave(turn.id,selected);setSavedNotice(selected.length+'개 계획을 CrewFit에 저장했어요.');}
  catch(err){setError(err.message||'계획을 저장하지 못했어요. 입력 내용은 유지돼요. 다시 시도해 주세요.');}
  finally{saveLock.current=false;setBusy(false);}
 }
 if(!items.length)return null;
 return <form className="coach-proposals proposal-review" onSubmit={submit} noValidate>
  <header className="proposal-review-heading"><div><span>PLAN REVIEW</span><h3>{context?'주차별 상세 일정':'제안받은 운동 계획'}</h3></div><strong>{items.length}개 일정</strong></header>
  <p>일정을 누르면 내용을 확인하고 수정할 수 있어요. 체크한 일정만 저장해요.</p>
  <fieldset disabled={busy}>
   {context&&<div className="proposal-review-weeks" aria-label="제안 주차">{weeks.map(week=><button type="button" key={week} aria-pressed={currentWeek===week} onClick={()=>chooseWeek(week)}>{week}주차</button>)}</div>}
   <div className="proposal-review-selection"><p role="status">{context&&<span>현재 주차 {currentSelected}개 · </span>}전체 <strong>{selected.length}개</strong> 저장 선택</p><div><button type="button" onClick={()=>selectWeek(null)}>전체 선택</button>{context&&<button type="button" onClick={()=>selectWeek(currentWeek)}>이 주차만 선택</button>}</div></div>
   <div className="proposal-review-workspace">
    <div className="proposal-review-list" role="group" aria-label="제안 일정 선택">
     {visible.map(item=><div key={item.position} className={'proposal-review-row'+(active?.position===item.position?' is-active':'')}>
      <label className="proposal-review-check"><input type="checkbox" aria-label={item.title+' 저장 선택'} checked={saved.has(item.position)||item.selected} disabled={saved.has(item.position)} onChange={e=>change(item.position,'selected',e.target.checked)}/></label>
      <button type="button" aria-pressed={active?.position===item.position} aria-controls={editorId} onClick={()=>setActivePosition(item.position)}><span className="proposal-review-date">{item.scheduled_on||'날짜 미입력'} · {item.start_time||'시각 미입력'}{saved.has(item.position)&&<em>저장됨</em>}</span><strong>{item.title||'운동 이름을 입력해 주세요'}</strong><small>{SPORT_LABEL[item.sport]} · {item.minutes||0}분 <span aria-hidden="true">↗</span></small></button>
     </div>)}
    </div>
    {active&&<section id={editorId} ref={editor} className="proposal-review-editor" aria-label="선택한 일정 편집">
     <div className="proposal-review-editor-heading"><strong>일정 {active.position+1} 상세</strong><span>{saved.has(active.position)?'저장 완료':active.selected?'저장할 일정':'저장 선택 안 됨'}</span></div>
     <fieldset disabled={saved.has(active.position)}>
      <label>운동 이름<input required maxLength={100} value={active.title} onChange={e=>change(active.position,'title',e.target.value)}/></label>
      <div className="proposal-review-fields"><label>종목<select value={active.sport} onChange={e=>change(active.position,'sport',e.target.value)}>{Object.entries(SPORT_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>운동 시간 · 분<input type="number" required min={5} max={240} step={1} value={active.minutes} onChange={e=>change(active.position,'minutes',e.target.value===''?'':Number(e.target.value))}/></label><label>날짜<input type="date" required min="2000-01-01" max="2100-12-31" value={active.scheduled_on} onChange={e=>change(active.position,'scheduled_on',e.target.value)}/></label><label>시작 시각<input type="time" required value={active.start_time} onChange={e=>change(active.position,'start_time',e.target.value)}/></label></div>
      <label>운동 메모<textarea rows={5} maxLength={1000} value={active.note} onChange={e=>change(active.position,'note',e.target.value)}/></label>
     </fieldset>
     <small>날짜·시각은 한국시간 기준이에요.</small>
    </section>}
   </div>
  </fieldset>
  {error&&<p className="proposal-review-error" role="alert">{error}</p>}
  <footer className="proposal-review-footer"><button className="btn btn-primary" disabled={busy||!selected.length}>{busy?'저장 중…':selected.length?selected.length+'개 계획 저장':'저장할 일정을 선택해 주세요'}</button><p>CrewFit에 저장해요. 구글 캘린더 전송은 내 계획에서 따로 할 수 있어요.</p></footer>
  {savedNotice&&<div className="plan-save-success" role="status"><strong>{savedNotice}</strong><button type="button" className="coach-plan-link" onClick={onViewPlans}>내 계획에서 확인하기 →</button></div>}
 </form>;
}
function ProposalSummary({turn,plans,onReview}){
 const total=turn.proposals?.length||0,mealTotal=turn.meal_proposals?.length||0;
 const saved=new Set(plans.filter(plan=>plan.turn_id===turn.id&&Number.isInteger(plan.position)&&plan.position>=0&&plan.position<total).map(plan=>plan.position)).size;
 return <div className="coach-proposal-summary"><div><span className="coach-proposal-kind">제안 · 직접 선택해서 저장</span><strong>아직 저장 전인 일정은 확인 후 저장해요</strong><p>{total>0&&<>운동 <b>{saved}/{total}개</b> 저장 확인</>}{total>0&&mealTotal>0?' · ':''}{mealTotal>0&&<>식단 {mealTotal}개 제안</>}</p>{mealTotal>0&&<small>식단 저장 여부는 제안 화면에서 확인할 수 있어요.</small>}</div><button type="button" className="btn btn-ghost" onClick={event=>onReview(turn,event)}>제안 확인하기 →</button></div>;
}
function PlanNotes({note}){
 if(!note?.trim())return null;
 return <div className="coach-plan-notes"><strong>운동 안내</strong><div>{note.split(/\r?\n/).filter(line=>line.trim()).map((line,index)=><p key={index}>{line}</p>)}</div></div>;
}
export default function CoachPage({embedded=false,initialView='conversation'}){
 const calendar=useCalendarPlans();const location=useLocation();
 const [search,setSearch]=useSearchParams();
 const route=coachRouteState(search,koreaToday(),initialView);
 const reviewOpen=!!location.state?.coachReviewId;
 const view=reviewOpen?'proposal':route.view,selectedDate=route.date;
 const savedPanel=useRef(null),reviewPanel=useRef(null),reviewTrigger=useRef(null);
 function setView(next){
  if(next==='proposal')return;
  const params=new URLSearchParams(search);params.set('view',next==='plans'?'plans':'chat');
  if(next==='plans')params.set('date',selectedDate);
  setSearch(params,{state:{...location.state,coachReviewId:null}});
 }
 function setSelectedDate(date){const params=new URLSearchParams(search);params.set('date',date);setSearch(params,{state:location.state});}
 useEffect(()=>{setSettings(false);},[route.view]);
 const [settings,setSettings]=useState(false),history=useRef(null),input=useRef(null),messageId=useId();
 const {user,token}=useAuth(),cache=useQueryClient(),pending=useRef(null),lock=useRef(false);
 const [browsing,setBrowsing]=useState(false),[selectedTurn,setSelectedTurn]=useState(null),[reviewTurn,setReviewTurn]=useState(null);
 const key=['coach',user.id],query=useQuery({queryKey:key,queryFn:()=>api('/coach',{token}),retry:false});
 const [message,setMessage]=useState(()=>typeof location.state?.coachPrompt==='string'?location.state.coachPrompt:''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[deleting,setDeleting]=useState(null);
 function showLatest(){const panel=history.current;if(!panel)return;const turn=panel.querySelector('.coach-turn:last-of-type .coach-answer');if(turn)panel.scrollTop+=turn.getBoundingClientRect().top-panel.getBoundingClientRect().top-16;else panel.scrollTop=0;}
 useEffect(()=>{if(!history.current||browsing)return;if(selectedTurn)history.current.scrollTop=0;else if(busy)history.current.scrollTop=history.current.scrollHeight;else showLatest();},[query.data?.turns?.at(-1)?.id,busy,browsing,selectedTurn?.id]);
 function openHistoryTurn(turn,plans){cache.setQueryData(key,old=>({...old,turns:old?.turns||[],plans:[...(old?.plans||[]).filter(p=>!plans.some(row=>row.id===p.id)),...plans]}));setSelectedTurn(turn);setBrowsing(false);}
 function recent(){setSelectedTurn(null);setBrowsing(false);requestAnimationFrame(showLatest);}


 function openPlans(){setView('plans');setSettings(false);requestAnimationFrame(()=>{savedPanel.current?.scrollIntoView({block:'start',behavior:'smooth'});savedPanel.current?.focus({preventScroll:true});});}
 const hasConversation=!!selectedTurn||!!query.data?.turns?.length;
 const dayPlans=(query.data?.plans||[]).filter(plan=>plan.scheduled_on===selectedDate).sort((a,b)=>a.start_time.localeCompare(b.start_time));
 function openReview(turn,event){reviewTrigger.current=event.currentTarget;setReviewTurn(turn);setSearch(search,{state:{...location.state,coachReviewId:turn.id}});requestAnimationFrame(()=>{reviewPanel.current?.scrollIntoView({block:'start'});reviewPanel.current?.focus({preventScroll:true});});}
 function closeReview(){setView('conversation');requestAnimationFrame(()=>{reviewTrigger.current?.focus();});}
 function choosePrompt(text){setMessage(text);input.current?.focus();}
 async function send(e,requestMessage=message){e?.preventDefault();if(lock.current||!requestMessage.trim())return;lock.current=true;setBusy(true);setError('');setNotice('');const text=requestMessage.trim();if(pending.current?.message!==text)pending.current={id:crypto.randomUUID(),message:text};try{const turn=await api('/coach/chat',{token,body:pending.current});cache.setQueryData(key,old=>({...old,turns:[...(old?.turns||[]).filter(t=>t.id!==turn.id),turn].slice(-30)}));pending.current=null;setMessage('');setSelectedTurn(null);setNotice('코치가 답변했어요.');void cache.invalidateQueries({queryKey:['coach-history',user.id]});}catch(err){setError(err.message);}finally{lock.current=false;setBusy(false);}}
 async function save(turn_id,items){const saved=await persistWorkoutPlans(options=>api('/coach/plans',{token,...options}),turn_id,items);cache.setQueryData(key,old=>({...old,plans:[...(old?.plans||[]).filter(p=>!saved.some(row=>row.id===p.id)),...saved].sort((a,b)=>b.scheduled_on.localeCompare(a.scheduled_on))}));void cache.invalidateQueries({queryKey:['coach',user.id,'today']});if(saved.length)setSelectedDate(saved[0].scheduled_on);setNotice('선택한 운동 계획을 CrewFit에 저장했어요.');}
 async function remove(id){setError('');try{await api('/coach/plans/'+id,{token,method:'DELETE'});await cache.invalidateQueries({queryKey:key});setDeleting(null);}catch(err){setError(err.message);}}
 return <div className={`coach-page ${!embedded&&settings?'coach-settings-active':''}`} data-coach-view={view}><Link className="coach-entry-back" to="/coach">← 코칭 선택으로</Link><header className="page-head"><div><span className="section-eyebrow">내 페이스에 맞춘 다음 한 걸음</span><h1>{settings?'식사 선호 설정':view==='plans'?'내 운동 계획':view==='proposal'?'제안 확인·저장':'코칭 대화'}</h1><p>{settings?'다음 식단 상담에 반영할 취향과 피할 음식을 정리해요.':view==='plans'?'저장한 운동을 날짜별로 살펴보고 일정을 준비해요.':view==='proposal'?'아직 저장 전인 제안을 검토하고 원하는 일정만 보관해요.':'운동과 식단을 이야기하고, 나에게 맞는 계획을 제안받아요.'}</p></div>{view==='conversation'&&<div className="coach-page-actions"><button className="btn coach-preferences-button" aria-pressed={settings} onClick={()=>setSettings(!settings)}>{settings?'대화로 돌아가기':'식사 선호 설정'}</button></div>}</header><nav className="coach-mobile-views" aria-label="코칭 화면"><button type="button" aria-pressed={view==='conversation'&&!settings} onClick={()=>{setSettings(false);setView('conversation');}}>대화</button><button type="button" aria-pressed={view==='plans'&&!settings} onClick={()=>{setSettings(false);setView('plans');}}>내 계획 <span>{query.data?.plans.length||0}</span></button></nav><section className="coach-settings"><div className="preferences-intro"><span className="section-eyebrow">MADE FOR YOUR TABLE</span><h2>좋아하는 음식부터, 피해야 할 음식까지</h2><p>한 번 저장하면 다음 식단 상담에 반영해요. 언제든 바꿀 수 있어요.</p></div><NutritionPreferences/></section><div className="coach-layout"><section className="coach-conversation"><div className="coach-history-toolbar"><div><strong>{browsing?'지난 코칭 찾기':selectedTurn?'지난 대화':'코칭 대화'}</strong><small>{browsing?'질문·답변과 날짜로 찾아보세요':selectedTurn?'선택한 대화만 보고 있어요':'기록을 다시 찾고, 대화를 이어가세요'}</small></div><button type="button" aria-pressed={browsing} onClick={()=>setBrowsing(!browsing)}>{browsing?'닫기':'대화 찾기'}</button><button type="button" onClick={recent}>최근 대화 ↓</button></div><div className="coach-archive-host" hidden={!browsing}><CoachHistory active={browsing} onSelect={openHistoryTurn}/></div><div hidden={browsing} className="coach-history" ref={history} tabIndex={0} role="region" aria-label="코칭 대화 기록">{query.isSuccess&&!hasConversation&&(<div className="card coach-intro"><h2>오늘, 무엇부터 함께할까요?</h2><p>최근 28일의 운동·식단 일부와 관심 운동·목표, 최근 대화를 참고해요. 메시지를 보내면 이 정보가 AI 답변 생성에 사용됩니다. GPS 경로·실명·이메일은 보내지 않아요.</p><div className="coach-prompts">{[['오늘 저녁 추천','내 식사 선호를 참고해서 오늘 저녁 식단을 제안해줘.'],['간편한 식단','15분 안에 준비할 수 있는 간편한 식단을 추천해줘.'],['운동 계획','이번 주 두 번, 30분씩 운동하고 싶어.']].map(([label,text])=><button key={label} type="button" disabled={busy} onClick={()=>choosePrompt(text)}>{label} <span aria-hidden="true">↗</span></button>)}</div></div>)}{query.isPending&&<p role="status">대화를 불러오고 있어요.</p>}{query.isError&&<div role="alert" className="card"><p>{query.error.message}</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 불러오기</button></div>}{(selectedTurn?[selectedTurn]:query.data?.turns)?.map(turn=><article className="coach-turn" key={turn.id} data-turn-id={turn.id}><time className="coach-turn-date" dateTime={turn.created_at}>{new Date(turn.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time><div className="coach-user"><small>나</small><p>{turn.message}</p></div><div className="coach-answer">{starterContext(turn.message)&&<div className="starter-result-scope"><strong>{starterContext(turn.message).weeks}주 입문 계획 제안</strong><p>계획 기간: {starterContext(turn.message).range}. 아래 주차별 일정을 확인해 주세요.</p><small>전체 일정 또는 원하는 주차를 선택해 저장할 수 있어요. 이전에 생성한 제안은 당시 만들어진 일정만 표시돼요.</small></div>}<strong>CrewFit 코치</strong><p>{turn.answer}</p>{(turn.proposals?.length>0||turn.meal_proposals?.length>0)&&<ProposalSummary turn={turn} plans={query.data?.plans||[]} onReview={openReview}/>}{!turn.proposals?.length&&!turn.meal_proposals?.length&&(selectedTurn||turn.id===query.data?.turns?.at(-1)?.id)&&<ConversationPlanRequest turn={turn} busy={busy} onRequest={text=>send(null,text)}/>}</div></article>)}{busy&&<p className="coach-thinking" role="status">코치가 나에게 맞는 계획을 생각하고 있어요…</p>}</div><form hidden={browsing} className="coach-composer card" onSubmit={send}><div className="coach-composer-heading"><label htmlFor={messageId}>코칭 요청하기</label><span>제안 확인 후 직접 저장해요</span></div><p className="coach-context-note">최근 운동·식단 일부와 관심 설정을 참고해요. GPS 경로·실명·이메일은 보내지 않아요.</p><textarea id={messageId} ref={input} maxLength={2000} required rows={2} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} placeholder="운동 계획이나 식단을 요청해 보세요. 날짜와 끼니도 알려주세요."/><div><small>{message.length}/2,000 · 지난 대화는 ‘대화 찾기’에서 검색</small><button className="btn btn-primary" disabled={busy||!message.trim()||!query.isSuccess}>{busy?'코치가 생각 중…':'보내기'}</button></div>{error&&<p role="alert">{error}</p>}<p role="status">{notice}</p></form></section><section ref={reviewPanel} tabIndex={-1} className="coach-review-panel" hidden={view!=='proposal'} aria-label="제안 일정 확인">{query.isPending&&<p role="status">제안을 불러오고 있어요.</p>}{query.isError&&<div role="alert"><p>제안을 불러오지 못했어요. 다시 시도해 주세요.</p><button type="button" className="btn btn-ghost" onClick={()=>query.refetch()}>다시 불러오기</button></div>}{query.isSuccess&&![...(query.data?.turns||[]),...(reviewTurn?[reviewTurn]:[])].some(t=>t.id===location.state?.coachReviewId)&&<p role="status">이 제안은 대화 찾기에서 다시 열어 주세요. 저장한 일정은 내 계획에서 확인할 수 있어요.</p>}<header><div><span className="section-eyebrow">REVIEW YOUR PLAN</span><h2>제안 일정 확인</h2><p>대화는 그대로 두고, 원하는 일정만 골라 저장해요.</p></div><button type="button" className="btn btn-ghost" onClick={closeReview}>대화로 돌아가기</button></header>{[...(query.data?.turns||[]),...(reviewTurn&&!(query.data?.turns||[]).some(t=>t.id===reviewTurn.id)?[reviewTurn]:[])].filter(t=>t.proposals?.length||t.meal_proposals?.length).map(turn=><div key={turn.id} hidden={location.state?.coachReviewId!==turn.id}><Proposal turn={turn} plans={query.data?.plans||[]} onSave={save} onViewPlans={openPlans}/><MealProposals turn={turn}/></div>)}</section><aside ref={savedPanel} id="saved-workout-plans" className="coach-saved card" tabIndex={-1}><span className="section-eyebrow">MY PLAN</span><h2>날짜별 일정</h2><p className="muted small">날짜를 누르면 그날의 계획을 볼 수 있어요.</p><CalendarPlanTools plans={dayPlans} calendar={calendar} date={selectedDate}/><div className="saved-plan-layout"><div className="saved-plan-calendar"><PlanCalendar plans={query.data?.plans||[]} selected={selectedDate} onSelect={setSelectedDate}/></div><div className="saved-plan-day"><div className="plan-day-heading"><h3>{Number(selectedDate.slice(5,7))}월 {Number(selectedDate.slice(8))}일</h3><span>{dayPlans.length}개 계획</span></div>{query.isPending&&<p role="status">계획을 불러오고 있어요.</p>}{query.isError&&<p role="alert">계획을 불러오지 못했어요. <button onClick={()=>query.refetch()}>다시 시도</button></p>}{query.isSuccess&&!dayPlans.length&&<div className="plan-day-empty"><strong>이날은 비워 둔 날이에요</strong><p>점이 있는 날짜를 선택하거나 코칭 대화에서 새 계획을 만들어 보세요.</p></div>}{calendar.exports.isError&&<p role="status">캘린더 추가 내역을 불러오지 못했어요. <button onClick={()=>calendar.exports.refetch()}>다시 확인</button></p>}{calendar.error&&<p role="alert">{calendar.error} <Link to="/me/settings?calendar=settings#profile-connections">연결 설정으로</Link></p>}{dayPlans.map(plan=><article key={plan.id}><div className="coach-saved-plan-top"><time dateTime={plan.scheduled_on+'T'+plan.start_time.slice(0,5)+'+09:00'}>{plan.start_time.slice(0,5)}<span>시작</span></time><div className="coach-saved-plan-meta"><span>{SPORT_LABEL[plan.sport]}</span><span>{plan.minutes}분</span></div></div><h3>{plan.title}</h3><PlanNotes note={plan.note}/><div className="saved-plan-actions"><Link className="btn btn-ghost saved-plan-record" to={'/activities/new?sport='+plan.sport} state={{workoutPlan:plan,planOwnerId:user.id,returnTo:'/coach?view=plans&date='+selectedDate}}>계획을 참고해 기록</Link><div className="plan-delete-footer">{deleting===plan.id?<div className="plan-delete-confirm"><p>저장한 계획을 삭제할까요?<small>이미 기록한 운동과 구글 일정은 유지돼요.</small></p><div><button className="btn btn-ghost" onClick={()=>remove(plan.id)}>삭제 확인</button><button className="btn btn-ghost" onClick={()=>setDeleting(null)}>취소</button></div></div>:<button className="btn btn-ghost coach-delete" onClick={()=>setDeleting(plan.id)}>계획 삭제</button>}</div></div></article>)}</div></div><Link className="coach-meal-plans-link" to="/meals?view=plans"><span>식단 계획</span><small>저장한 끼니 확인하기 →</small></Link><p className="muted small">한국시간 기준 · 최근 100개<br/>앱의 계획을 삭제해도 구글 일정은 유지돼요.</p>{error&&<p role="alert">{error}</p>}</aside></div></div>;
}


