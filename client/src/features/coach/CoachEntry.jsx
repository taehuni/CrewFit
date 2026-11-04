import {useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {koreaToday} from '../../shared/calendar.js';
import CoachPage from './CoachPage.jsx';
import {starterPrompt,firstWeekLabel} from './starterPlan.js';
import './coach-entry.css';
import './coach-hub.css';
import '../pose/pose.css';
import './coach-workspace.css';

function StarterPlan(){
 const {user,token}=useAuth(),cache=useQueryClient(),navigate=useNavigate(),pending=useRef(null),lock=useRef(false);
 const [form,setForm]=useState({sport:'걷기',goal:'운동 습관 만들기',place:'집 근처 야외',minutes:'20',weeks:'2',days:[],date:koreaToday(),time:'19:00',note:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const set=(key,value)=>setForm(old=>({...old,[key]:value}));
 async function submit(e){e.preventDefault();if(lock.current)return;setError('');let message;try{message=starterPrompt(form);}catch(err){setError(err.message);return;}lock.current=true;setBusy(true);if(pending.current?.message!==message)pending.current={id:crypto.randomUUID(),message};try{const turn=await api('/coach/chat',{token,body:pending.current});cache.setQueryData(['coach',user.id],old=>old?{...old,turns:[...old.turns.filter(t=>t.id!==turn.id),turn].slice(-30)}:undefined);await cache.invalidateQueries({queryKey:['coach',user.id]});navigate('/coach?view=chat',{state:{starterComplete:true}});}catch(err){setError(err.message);}finally{lock.current=false;setBusy(false);}}
 return <div className="coach-starter"><Link className="coach-entry-back" to="/coach">← 코칭 선택으로</Link><header><span className="section-eyebrow">START AT YOUR PACE</span><h1>어떤 시작을 해볼까요?</h1><p>정답은 없어요. 지금의 취향과 가능한 시간부터 알려주세요.</p></header><form onSubmit={submit}><fieldset disabled={busy}><section><h2><span>01</span> 해보고 싶은 운동</h2><div className="starter-options" role="group" aria-label="시작할 운동">{['헬스','러닝','걷기','자전거','수영','아직 모르겠어요'].map(sport=><button key={sport} type="button" aria-pressed={form.sport===sport} onClick={()=>set('sport',sport)}>{sport}</button>)}</div><div className="starter-fields"><label>시작하는 이유<select value={form.goal} onChange={e=>set('goal',e.target.value)}>{['운동 습관 만들기','기초 체력 기르기','기분 전환하기','근력 기르기','아직 정하지 않았어요'].map(x=><option key={x}>{x}</option>)}</select></label><label>운동할 장소<select value={form.place} onChange={e=>set('place',e.target.value)}>{['집 근처 야외','집 · 기구 없음','헬스장','수영장','아직 정하지 않았어요'].map(x=><option key={x}>{x}</option>)}</select></label></div></section><section><h2><span>02</span> 나에게 맞는 일정</h2><div className="starter-fields"><label>한 번에 쓸 수 있는 시간<select value={form.minutes} onChange={e=>set('minutes',e.target.value)}>{[10,20,30,45,60].map(x=><option key={x} value={x}>{x}분</option>)}</select></label><label>전체 계획 기간<select value={form.weeks} onChange={e=>set('weeks',e.target.value)}>{[1,2,4].map(x=><option key={x} value={x}>{x}주</option>)}</select></label><label>시작 날짜<input required type="date" value={form.date} min={koreaToday()} max="2100-12-31" onChange={e=>set('date',e.target.value)}/></label><label>운동 시작 시각<input required type="time" value={form.time} onChange={e=>set('time',e.target.value)}/></label></div><div className="starter-scope" aria-live="polite"><strong>{form.weeks}주 전체 일정을 함께 설계해요</strong><div><span>계획 기간</span><p>{firstWeekLabel(form.date,form.weeks)||'시작 날짜를 선택해 주세요'}</p></div><div><span>저장할 일정</span><p>선택한 요일에 맞춰 전체 기간의 일정을 제안해요. 주차별로 확인한 뒤 전체 또는 원하는 주만 저장할 수 있어요.</p></div><small>실천하면서 다음 주의 날짜와 운동 내용을 조정할 수 있어요.</small></div><p className="starter-label">가능한 요일 · 여러 개 선택</p><div className="starter-days" role="group" aria-label="운동 가능한 요일">{['월','화','수','목','금','토','일'].map(day=><button type="button" key={day} aria-pressed={form.days.includes(day)} onClick={()=>set('days',form.days.includes(day)?form.days.filter(x=>x!==day):[...form.days,day])}>{day}</button>)}</div></section><section><h2><span>03</span> 고려했으면 하는 점</h2><label>시간 제약이나 피하고 싶은 운동 등 · 선택<textarea maxLength={500} rows={3} value={form.note} onChange={e=>set('note',e.target.value)} placeholder="예: 야근이 잦아서 짧게 하고 싶어요. 달리기보다는 걷기가 좋아요."/></label></section></fieldset><div className="starter-submit"><p>선택한 내용과 최근 기록 일부가 AI에 전달돼요. 주차별 방향과 전체 기간의 일정을 제안하며, 확인한 계획만 직접 저장할 수 있어요.</p>{error&&<p role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy?'나에게 맞는 시작을 설계하고 있어요…':'전체 기간 일정 제안받기 →'}</button><p role="status">{busy?'잠시만 기다려 주세요. 제안이 준비되면 코칭 대화로 이동해요.':''}</p></div></form></div>;
}
export default function CoachEntry(){
 const location=useLocation();const mode=new URLSearchParams(location.search).get('view');
 if(mode==='start')return <StarterPlan/>;
 if(mode==='chat'||mode==='plans'||location.state?.coachPrompt)return <CoachPage initialView={mode==='plans'?'plans':'conversation'}/>;
 return <CoachHub/>;
}

function HubIcon({kind}) {
 const paths={
  start:<><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><circle cx="12" cy="12" r="5"/></>,
  report:<><path d="M4 4v16h16M8 15l4-5 4 3 4-7"/><path d="M16 6h4v4"/></>,
  chat:<><path d="M20 11a8 8 0 0 1-8 8H5l-3 3v-9a10 10 0 0 1 18-6"/><path d="M8 9h8M8 13h5"/></>,
  plans:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5 2 2 5-4"/></>,
 };
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function CoachHub() {
 return <div className="coach-hub">
  <header className="coach-hub-heading">
   <div><span className="coach-hub-eyebrow">MY COACHING</span><h1>코칭</h1><p>계획부터 실천까지, 내 페이스로 이어가요.</p></div>
   <Link className="coach-hub-plan-shortcut" to="/coach?view=plans"><HubIcon kind="plans"/>내 계획 보기<span aria-hidden="true">↗</span></Link>
  </header>
  <div className="coach-hub-grid">
   <Link className="coach-hub-start" to="/coach?view=start">
    <div className="coach-hub-start-content">
     <span className="coach-hub-tag"><span aria-hidden="true"/>처음 시작하거나 새 루틴이 필요할 때</span>
     <h2>운동 계획,<br/>지금의 나에게 맞게.</h2>
     <p>하고 싶은 운동과 가능한 시간을 알려주세요.<br className="coach-hub-desktop-break"/> 무리 없이 시작할 1·2·4주 계획을 제안해요.</p>
     <span className="coach-hub-primary-action">맞춤 계획 만들기 <span aria-hidden="true">↗</span></span>
    </div>
    <div className="coach-hub-plan-visual" aria-hidden="true">
     <div className="coach-hub-visual-title"><HubIcon kind="start"/><span>나에게 맞는 계획을 설계하는 순서</span></div>
     <div className="coach-hub-visual-steps"><span><i/>운동 선택</span><span><i/>시간 맞추기</span><span><i/>계획 확인</span></div>
    </div>
   </Link>
   <Link className="coach-hub-route coach-hub-report" to="/feedback">
    <span className="coach-hub-icon"><HubIcon kind="report"/></span>
    <div className="coach-hub-route-body"><span className="coach-hub-label">기록에서 찾는 다음 한 걸음</span><h2>운동 리포트</h2><p>운동과 식단 기록을 돌아보고,<br/>잘한 점과 다음 행동을 확인해요.</p><strong>내 기록 분석하기 <span aria-hidden="true">↗</span></strong></div>
   </Link>
   <Link className="coach-hub-route coach-hub-chat" to="/coach?view=chat">
    <span className="coach-hub-icon"><HubIcon kind="chat"/></span>
    <div className="coach-hub-route-body"><span className="coach-hub-label">목표가 바뀌어도 괜찮아요</span><h2>코칭 대화</h2><p>운동·식단을 물어보고,<br/>지금 나에게 맞는 계획으로 조정해요.</p><strong>상담 시작하기 <span aria-hidden="true">↗</span></strong></div>
   </Link>
  </div>
  <Link className="coach-hub-schedule" to="/coach?view=plans">
   <span className="coach-hub-icon"><HubIcon kind="plans"/></span>
   <div><h2>계획을 세웠다면, 이제 한 걸음</h2><p>저장한 운동 일정을 달력에서 확인해요.</p></div>
   <span className="coach-hub-schedule-action">내 일정 확인 <span aria-hidden="true">→</span></span>
  </Link>
  <Link className="coach-hub-pose" to="/pose"><span aria-hidden="true">↗</span><div><small>카메라로 확인하는 움직임</small><h2>운동 자세 확인</h2><p>스쿼트·런지·푸시업, 촬영 방향에 맞는 피드백을 확인해요.</p></div><strong>시작하기 →</strong></Link>
  <p className="coach-hub-footnote">제안받은 계획은 직접 확인하고 선택해요. 나에게 필요한 일정만 골라 저장하세요.</p>
 </div>;
}
