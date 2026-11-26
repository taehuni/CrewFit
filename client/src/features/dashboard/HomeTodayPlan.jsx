import {Link} from 'react-router';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {SPORT_LABEL} from '../../shared/ui.jsx';
import {loadHomeTodayPlans} from './homeTodayPlans.js';
import './home-plan-status.css';
export default function HomeTodayPlan({today}){
 const {user}=useAuth();
 const query=useQuery({queryKey:['coach',user.id,'today',today],queryFn:()=>loadHomeTodayPlans(supabase,user.id,today),retry:false});
 const unavailable=query.data?.plans.some(plan=>plan.completion_available===false);
 return <section className="home-today-plan" aria-label="오늘의 운동 계획">
   <header><div><span className="home-today-dot" aria-hidden="true"/><h2>오늘의 계획</h2><time dateTime={today}>{Number(today.slice(5,7))}월 {Number(today.slice(8))}일</time></div>{query.isSuccess&&query.data.count>0&&<Link to={'/coach?view=plans&date='+encodeURIComponent(today)}>계획 보기{query.data.count>2?` · ${query.data.count}개`:''} →</Link>}</header>
   {query.isPending?<p role="status">오늘 일정을 확인하고 있어요.</p>:query.isError?<div className="home-plan-empty"><p>오늘 계획을 불러오지 못했어요.</p><button type="button" onClick={()=>query.refetch()}>다시 확인</button></div>:query.data.plans.length?<ul>{query.data.plans.map(plan=><li key={plan.id}><time>{plan.start_time.slice(0,5)}</time><strong>{plan.title}</strong><span>{SPORT_LABEL[plan.sport]||'운동'} · {plan.minutes}분</span><div className="home-plan-progress">{plan.completion_available===false?<span>완료 여부 확인 필요</span>:plan.activity_id?<><span className="home-plan-complete">✓ 운동 기록 완료</span><Link to={'/activities/'+encodeURIComponent(plan.activity_id)}>기록 보기 →</Link></>:<span>운동 예정 · 아직 기록 전</span>}</div></li>)}</ul>:<div className="home-plan-empty"><p>오늘 예정된 운동은 없어요. 내 페이스대로 움직여 보세요.</p><Link to="/coach">나에게 맞는 코칭 선택 →</Link></div>}
   {query.isSuccess&&unavailable&&<div className="home-plan-empty home-plan-connection-error"><p role="status">운동 기록 연결을 확인하지 못했어요.</p><button type="button" disabled={query.isFetching} onClick={()=>query.refetch()}>{query.isFetching?'확인 중…':'완료 여부 다시 확인'}</button></div>}
 </section>;
}
