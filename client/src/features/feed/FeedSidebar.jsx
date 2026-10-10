import {Link} from 'react-router';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {loadMyCrews,SPORTS} from '../crews/crews.js';
import CrewMark from '../../shared/CrewMark.jsx';

export default function FeedSidebar(){
  const {user}=useAuth();
  const mine=useInfiniteQuery({queryKey:queryKeys.myCrews(user.id),initialPageParam:null,queryFn:({pageParam})=>loadMyCrews(supabase,user.id,pageParam),getNextPageParam:p=>p.next,retry:false});
  const crews=mine.data?.pages.flatMap(p=>p.rows).filter(r=>r.crews).slice(0,4)||[];
  return <aside className="feed-sidebar" aria-label="내 크루와 운동 바로가기">
    <section className="feed-side-card"><header><h2>내 크루</h2><Link to="/crews">전체 보기 ↗</Link></header>
      {mine.isPending?<p role="status">내 크루를 불러오는 중…</p>:mine.isError?<><p>내 크루를 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>mine.refetch()}>다시 불러오기</button></>:crews.length?<ul>{crews.map(({crews:c,status})=><li key={c.id}><Link to={`/crews/${c.id}`}><CrewMark name={c.name} sport={c.sport}/><span><strong>{c.name}</strong><small>{SPORTS[c.sport]||'운동'} · {status==='approved'?'함께하는 크루':'가입 대기 중'}</small></span><span aria-hidden="true">›</span></Link></li>)}</ul>:<div className="feed-side-empty"><p>함께하면 더 꾸준해져요.</p><small>같은 운동을 즐기는 크루를 찾아보세요.</small><Link className="btn btn-ghost" to="/crews">크루 둘러보기</Link></div>}
    </section>
    <section className="feed-side-card feed-side-record"><span className="section-eyebrow">오늘의 움직임</span><h2>운동을 이야기로 남겨요</h2><p>오늘 달린 거리, 마지막 한 세트.<br/>나의 기록이 다음 운동의 시작이 돼요.</p><Link className="btn btn-primary" to="/activities/new">운동 기록하기 ↗</Link><Link className="feed-side-secondary" to="/activities">내 운동 기록 보기</Link></section>
    <p className="feed-side-footnote">서로의 페이스를 존중하며<br/>작은 성취도 함께 응원해 주세요.</p>
  </aside>;
}
