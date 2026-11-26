import ConversationPlanRequest from './ConversationPlanRequest.jsx';
import './plan-delete.css';
import CoachHistory from './CoachHistory.jsx';
import {starterContext,proposalWeek} from './starterPlan.js';
import SavedWorkoutPlans from './SavedWorkoutPlans.jsx';
import {koreaToday} from './planCalendar.js';
import {proposalSavedDate} from './proposalNavigation.js';
import {persistWorkoutPlans,refreshSavedWorkoutPlans} from './planSaving.js';
import {NutritionPreferences,MealProposals} from './NutritionCoach.jsx';
import {useCalendarPlans} from './CalendarPlans.jsx';
import {useRef,useState,useEffect,useId} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router';
import {coachRouteState} from './coachRoute.js';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {SPORT_LABEL} from '../../shared/ui.jsx';
import useLeaveGuard from '../../shared/useLeaveGuard.jsx';
import {proposalDraftChanged,proposalDrafts,refreshProposalDrafts} from './planDrafts.js';
import useConversationHeight from './useConversationHeight.js';
import useCoachDraft from './useCoachDraft.js';
import AiDataNotice from '../../shared/AiDataNotice.jsx';
import {loadReviewTurn,reviewId as validReviewId} from './mealReturn.js';
import {supabase} from '../../shared/supabaseClient.js';
import './coach.css';
import './proposal-review.css';
import './coach-draft.css';
export function Proposal({turn,plans,onSave,onViewPlans,active:reviewActive=true}){
 const [items,setItems]=useState(()=>proposalDrafts(turn.proposals,plans,turn.id));
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
 const dirty=useRef(false);
 dirty.current=proposalDraftChanged(items,turn.proposals,saved);
 const guard=useLeaveGuard(()=>reviewActive&&(dirty.current||saveLock.current),'수정한 제안이 아직 저장되지 않았어요. 나가면 수정 내용이 사라져요.');
 const savedVersion=JSON.stringify(plans.filter(plan=>plan.turn_id===turn.id));
 useEffect(()=>{setItems(current=>refreshProposalDrafts(current,turn.proposals,plans,turn.id,reviewActive));if(!reviewActive)setError('');},[reviewActive,turn.proposals,savedVersion]);
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
 return <form className="coach-proposals proposal-review" onSubmit={submit} noValidate>{guard}
  <header className="proposal-review-heading"><div><h3>{context?'주차별 상세 일정':'제안받은 운동 계획'}</h3></div><strong>{items.length}개 일정</strong></header>
  <p>저장할 일정을 선택하고 내용을 수정하세요.</p>
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
  <footer className="proposal-review-footer"><button className="btn btn-primary" disabled={busy||!selected.length}>{busy?'저장 중…':selected.length?selected.length+'개 계획 저장':items.every(item=>saved.has(item.position))?'모두 저장됨':'저장할 일정을 선택해 주세요'}</button><p>CrewFit에 저장해요. 구글 캘린더 전송은 내 계획에서 따로 할 수 있어요.</p></footer>
  {savedNotice&&<div className="plan-save-success" role="status"><strong>{savedNotice}</strong><button type="button" className="coach-plan-link" onClick={onViewPlans}>내 계획에서 확인하기 →</button></div>}
 </form>;
}
function ProposalSummary({turn,plans,onReview,onViewPlans}){
 const total=turn.proposals?.length||0,mealTotal=turn.meal_proposals?.length||0;
 const saved=new Set(plans.filter(plan=>plan.turn_id===turn.id&&Number.isInteger(plan.position)&&plan.position>=0&&plan.position<total).map(plan=>plan.position)).size;
 const allWorkoutsSaved=total>0&&saved===total;
 return <div className="coach-proposal-summary"><div><strong>{allWorkoutsSaved&&!mealTotal?'운동 계획을 모두 저장했어요':'나에게 맞춘 계획'}</strong><p>{total>0&&<>운동 <b>{saved}/{total}개</b> 저장</>}{total>0&&mealTotal>0?' · ':''}{mealTotal>0&&<>식단 {mealTotal}개 제안</>}</p></div><button type="button" className="btn btn-ghost" onClick={allWorkoutsSaved&&!mealTotal?()=>onViewPlans(proposalSavedDate(turn.id,plans)):event=>onReview(turn,event)}>{allWorkoutsSaved&&!mealTotal?'내 계획 보기 →':'제안 확인하기 →'}</button></div>;
}
export default function CoachPage({embedded=false,initialView='conversation'}){
 const calendar=useCalendarPlans();const location=useLocation();
 const [search,setSearch]=useSearchParams();
 const route=coachRouteState(search,koreaToday(),initialView);
 const reviewId=validReviewId(search.get('review'))||validReviewId(location.state?.coachReviewId),reviewOpen=!!reviewId;
 const view=reviewOpen?'proposal':route.view,selectedDate=route.date;
 const savedPanel=useRef(null),reviewPanel=useRef(null),reviewTrigger=useRef(null),page=useRef(null),conversation=useRef(null),savedDate=useRef(null);
 function setView(next){
  if(next==='proposal')return;
  const params=new URLSearchParams(search);params.set('view',next==='plans'?'plans':'chat');params.delete('settings');params.delete('review');params.delete('meal');
  if(next==='plans')params.set('date',savedDate.current||selectedDate);
  setSearch(params,{state:{...location.state,coachReviewId:null}});
 }
 function setSelectedDate(date){savedDate.current=null;const params=new URLSearchParams(search);params.set('date',date);setSearch(params,{state:location.state});}
 const settings=view==='conversation'&&search.get('settings')==='nutrition';
 function setSettings(next){const params=new URLSearchParams(search);params.set('view','chat');params.delete('review');params.delete('meal');if(next)params.set('settings','nutrition');else params.delete('settings');setSearch(params,{state:{...location.state,coachReviewId:null}});}
 const history=useRef(null),input=useRef(null),messageId=useId();
 const {user,token}=useAuth(),cache=useQueryClient(),pending=useRef(null),lock=useRef(false);
 const [browsing,setBrowsing]=useState(false),[selectedTurn,setSelectedTurn]=useState(null),[branchTurns,setBranchTurns]=useState([]),[reviewTurn,setReviewTurn]=useState(null);
 useConversationHeight(page,conversation,view==='conversation'&&!settings);
 const contextTurnId=selectedTurn?.id||reviewId;
 const key=['coach',user.id,contextTurnId||'recent'],query=useQuery({queryKey:key,queryFn:()=>api('/coach'+(contextTurnId?'?turn_id='+encodeURIComponent(contextTurnId):''),{token}),retry:false});
 const reviewQuery=useQuery({queryKey:['coach-review',user.id,reviewId],queryFn:({signal})=>loadReviewTurn(supabase,user.id,reviewId,signal),enabled:reviewOpen,retry:false});
 const reviewTurns=[...(query.data?.turns||[])];
 for(const turn of [reviewTurn,reviewQuery.data])if(turn&&!reviewTurns.some(item=>item.id===turn.id))reviewTurns.push(turn);
 const {message,setMessage,guard:draftGuard,kept:draftKept}=useCoachDraft(user.id,typeof location.state?.coachPrompt==='string'?location.state.coachPrompt:'');
 const incomingPrompt=typeof location.state?.coachPrompt==='string'&&location.state.coachPrompt!==message?location.state.coachPrompt:'';
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 function clearIncomingPrompt(){const params=new URLSearchParams(search);if(!params.has('view'))params.set('view','chat');setSearch(params,{replace:true,state:{...location.state,coachPrompt:null}});}
 useEffect(()=>{if(location.state?.coachPrompt&&!incomingPrompt)clearIncomingPrompt();},[location.state?.coachPrompt,incomingPrompt]);
 function showLatest(){const panel=history.current;if(!panel)return;const turn=panel.querySelector('.coach-turn:last-of-type .coach-answer');if(turn)panel.scrollTop+=turn.getBoundingClientRect().top-panel.getBoundingClientRect().top-16;else panel.scrollTop=0;}
 useEffect(()=>{if(!history.current||browsing)return;if(selectedTurn&&branchTurns.length===1)history.current.scrollTop=0;else if(busy)history.current.scrollTop=history.current.scrollHeight;else showLatest();},[query.data?.turns?.at(-1)?.id,busy,browsing,selectedTurn?.id,branchTurns.length]);
 function openHistoryTurn(turn,plans){cache.setQueryData(['coach',user.id,turn.id],old=>({...old,turns:old?.turns||query.data?.turns||[],plans:[...(old?.plans||query.data?.plans||[]).filter(p=>!plans.some(row=>row.id===p.id)),...plans]}));setSelectedTurn(turn);setBranchTurns([turn]);setBrowsing(false);}
 function recent(){setSelectedTurn(null);setBranchTurns([]);setBrowsing(false);requestAnimationFrame(showLatest);}


 function openPlans(date){if(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date))savedDate.current=date;setView('plans');requestAnimationFrame(()=>{savedPanel.current?.scrollIntoView({block:'start',behavior:'smooth'});savedPanel.current?.focus({preventScroll:true});});}
 const hasConversation=!!selectedTurn||!!query.data?.turns?.length;
 function openReview(turn,event){reviewTrigger.current=event.currentTarget;setReviewTurn(turn);const params=new URLSearchParams(search);params.set('view','chat');params.set('review',turn.id);params.delete('meal');setSearch(params,{state:{...location.state,coachReviewId:turn.id,coachMealSelection:null}});requestAnimationFrame(()=>{reviewPanel.current?.scrollIntoView({block:'start'});reviewPanel.current?.focus({preventScroll:true});});}
 function closeReview(){setView('conversation');requestAnimationFrame(()=>{reviewTrigger.current?.focus();});}
 function choosePrompt(text){setMessage(text);input.current?.focus();}
 async function send(e,requestMessage=message){
  e?.preventDefault();if(lock.current||!requestMessage.trim())return;
  lock.current=true;setBusy(true);setError('');setNotice('');
  const text=requestMessage.trim(),contextIds=selectedTurn?branchTurns.slice(-8).map(turn=>turn.id):undefined;
  if(pending.current?.message!==text||JSON.stringify(pending.current?.context_turn_ids)!==JSON.stringify(contextIds))pending.current={id:crypto.randomUUID(),message:text,...(contextIds?{context_turn_ids:contextIds}:{})};
  try{
   const turn=await api('/coach/chat',{token,body:pending.current});
   cache.setQueryData(['coach',user.id,'recent'],old=>({...old,plans:old?.plans||[],turns:[...(old?.turns||query.data?.turns||[]).filter(t=>t.id!==turn.id),turn].slice(-30)}));
   if(selectedTurn)setBranchTurns(previous=>[...previous.filter(item=>item.id!==turn.id),turn]);
   pending.current=null;if(requestMessage===message)setMessage('');setNotice('코치가 답변했어요.');
   void cache.invalidateQueries({queryKey:['coach-history',user.id]});
  }catch(err){setError(err.message);}finally{lock.current=false;setBusy(false);}
 }

 async function save(turn_id,items){const saved=await persistWorkoutPlans(options=>api('/coach/plans',{token,...options}),turn_id,items);void refreshSavedWorkoutPlans(cache,user.id,key,saved);if(saved.length)savedDate.current=saved[0].scheduled_on;setNotice('선택한 운동 계획을 CrewFit에 저장했어요.');}
 return <div ref={page} className={`coach-page ${!embedded&&settings?'coach-settings-active':''}`} data-coach-view={view}>{draftGuard}<Link className="coach-entry-back" to="/coach">← 코칭 선택으로</Link><header className="page-head"><div><h1>{settings?'식사 선호 설정':view==='plans'?'내 운동 계획':view==='proposal'?'제안 확인·저장':'코칭 대화'}</h1></div>{view==='proposal'&&<button type="button" className="btn btn-ghost" onClick={closeReview}>대화로 돌아가기</button>}{view==='conversation'&&<div className="coach-page-actions"><button className="btn coach-preferences-button" aria-pressed={settings} onClick={()=>setSettings(!settings)}>{settings?'대화로 돌아가기':'식사 선호 설정'}</button></div>}</header><nav hidden={view==='proposal'||settings} className="coach-mobile-views" aria-label="코칭 화면"><button type="button" aria-pressed={view==='conversation'&&!settings} onClick={()=>setView('conversation')}>대화</button><button type="button" aria-pressed={view==='plans'&&!settings} onClick={()=>setView('plans')}>내 계획</button></nav>{settings&&<section className="coach-settings"><div className="preferences-intro"><span className="section-eyebrow">MADE FOR YOUR TABLE</span><h2>좋아하는 음식부터, 피해야 할 음식까지</h2><p>한 번 저장하면 다음 식단 상담에 반영해요. 언제든 바꿀 수 있어요.</p></div><NutritionPreferences/></section>}<div className="coach-layout"><section ref={conversation} className="coach-conversation"><div className="coach-history-toolbar"><div><strong>{browsing?'지난 코칭 찾기':selectedTurn?'지난 대화':'코칭 대화'}</strong></div><button type="button" disabled={busy} aria-pressed={browsing} onClick={()=>setBrowsing(!browsing)}>{browsing?'닫기':'대화 찾기'}</button><button type="button" disabled={busy} onClick={recent}>최근 대화 ↓</button></div><div className="coach-archive-host" hidden={!browsing}><CoachHistory active={browsing} onSelect={openHistoryTurn}/></div><div hidden={browsing} className="coach-history" ref={history} tabIndex={0} role="region" aria-label="코칭 대화 기록">{query.isSuccess&&!hasConversation&&(<div className="card coach-intro"><h2>오늘, 무엇부터 함께할까요?</h2><p>운동과 식단에 대해 편하게 물어보세요.</p><div className="coach-prompts">{[['오늘 저녁 추천','내 식사 선호를 참고해서 오늘 저녁 식단을 제안해줘.'],['간편한 식단','15분 안에 준비할 수 있는 간편한 식단을 추천해줘.'],['운동 계획','이번 주 두 번, 30분씩 운동하고 싶어.']].map(([label,text])=><button key={label} type="button" disabled={busy} onClick={()=>choosePrompt(text)}>{label} <span aria-hidden="true">↗</span></button>)}</div></div>)}{query.isPending&&<p role="status">대화를 불러오고 있어요.</p>}{query.isError&&<div role="alert" className="card"><p>{query.error.message}</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 불러오기</button></div>}{(selectedTurn?branchTurns:query.data?.turns)?.map(turn=><article className="coach-turn" key={turn.id} data-turn-id={turn.id}><time className="coach-turn-date" dateTime={turn.created_at}>{new Date(turn.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time><div className="coach-user"><small>나</small><p>{turn.message}</p></div><div className="coach-answer">{starterContext(turn.message)&&<div className="starter-result-scope"><strong>{starterContext(turn.message).weeks}주 입문 계획 제안</strong><p>계획 기간: {starterContext(turn.message).range}. 아래 주차별 일정을 확인해 주세요.</p><small>전체 일정 또는 원하는 주차를 선택해 저장할 수 있어요. 이전에 생성한 제안은 당시 만들어진 일정만 표시돼요.</small></div>}<strong>CrewFit 코치</strong><p>{turn.answer}</p>{(turn.proposals?.length>0||turn.meal_proposals?.length>0)&&<ProposalSummary turn={turn} plans={query.data?.plans||[]} onReview={openReview} onViewPlans={openPlans}/>}{!turn.proposals?.length&&!turn.meal_proposals?.length&&turn.id===(selectedTurn?branchTurns:query.data?.turns)?.at(-1)?.id&&<ConversationPlanRequest turn={turn} busy={busy} onRequest={text=>send(null,text)}/>}</div></article>)}{busy&&<p className="coach-thinking" role="status">코치가 나에게 맞는 계획을 생각하고 있어요…</p>}</div><form hidden={browsing} className="coach-composer card" onSubmit={send}>{incomingPrompt&&<div className="coach-incoming-prompt" role="status"><p>작성 중인 질문을 복구했어요. 다른 화면에서 가져온 새 질문으로 바꿀 수도 있어요.</p><div><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{setMessage(incomingPrompt);clearIncomingPrompt();input.current?.focus();}}>가져온 질문으로 바꾸기</button><button type="button" className="btn btn-ghost" onClick={clearIncomingPrompt}>작성 중인 질문 유지</button></div></div>}<div className="coach-composer-heading"><label htmlFor={messageId}>코칭 요청하기</label><span className="coach-composer-meta">{message.length}/2,000{!draftKept?' · 초안 보관 불가':''}</span></div><textarea id={messageId} ref={input} maxLength={2000} required rows={2} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} placeholder={selectedTurn?"선택한 대화에 이어서 질문해 보세요.":"운동이나 식단에 대해 이야기해 보세요."}/><div className="coach-composer-actions"><AiDataNotice/><button className="btn btn-primary" disabled={busy||!message.trim()||!query.isSuccess}>{busy?'코치가 생각 중…':'보내기'}</button></div>{error&&<p role="alert">{error}</p>}<p role="status">{notice}</p></form></section><section ref={reviewPanel} tabIndex={-1} className="coach-review-panel" hidden={view!=='proposal'} aria-label="제안 일정 확인">{(query.isPending||(reviewOpen&&reviewQuery.isPending))&&<p role="status">제안을 불러오고 있어요.</p>}{(query.isError||(reviewOpen&&reviewQuery.isError))&&<div role="alert"><p>제안을 불러오지 못했어요. 다시 시도해 주세요.</p><button type="button" className="btn btn-ghost" onClick={()=>{query.refetch();reviewQuery.refetch();}}>다시 불러오기</button></div>}{query.isSuccess&&reviewQuery.isSuccess&&!reviewTurns.some(t=>t.id===reviewId)&&<p role="status">이 제안은 대화 찾기에서 다시 열어 주세요. 저장한 일정은 내 계획에서 확인할 수 있어요.</p>}{reviewTurns.filter(t=>t.proposals?.length||t.meal_proposals?.length).map(turn=><div key={turn.id} hidden={reviewId!==turn.id}><Proposal turn={turn} plans={query.data?.plans||[]} onSave={save} onViewPlans={openPlans} active={view==='proposal'&&reviewId===turn.id}/>{turn.meal_proposals?.length>0&&<MealProposals turn={turn} active={view==='proposal'&&reviewId===turn.id}/>}</div>)}</section><aside ref={savedPanel} id="saved-workout-plans" className="coach-saved card" tabIndex={-1}><SavedWorkoutPlans active={view==='plans'} selectedDate={selectedDate} onSelect={setSelectedDate} calendar={calendar}/></aside></div></div>;
}


