import { Link, useSearchParams } from 'react-router';
import { useInfiniteQuery,useQuery } from '@tanstack/react-query';
import {useState} from 'react';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, loadCrews,loadMyCrews,loadRegions } from './crews.js';
import './crews.css';
import CrewRecommendations from './CrewRecommendations.jsx';
import CrewCard from './CrewCard.jsx';
import {optionalResult} from '../../shared/community.js';

export default function CrewsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const sport = params.get('sport') || '';
  const filters={search:params.get('q')||'',region:params.get('region')||''};
  const [search,setSearch]=useState(filters.search);
  const mine=useInfiniteQuery({queryKey:queryKeys.myCrews(user.id),initialPageParam:null,queryFn:({pageParam})=>loadMyCrews(supabase,user.id,pageParam),getNextPageParam:p=>p.next,retry:false});
  const regions=useQuery({queryKey:queryKeys.regions(user.id),queryFn:()=>loadRegions(supabase),staleTime:3600000});
  const crews = useInfiniteQuery({ queryKey: queryKeys.crewList(user.id, sport,filters), initialPageParam: null,
    queryFn: ({ pageParam }) => loadCrews(supabase, sport, pageParam,filters), getNextPageParam: page => page.nextCursor, retry: false });
  const rows = crews.data?.pages.flatMap(page => page.rows) || [];
  const ids=rows.map(c=>c.id).slice(0,100);
  const recent=useQuery({queryKey:queryKeys.recentCrews(user.id,ids),queryFn:()=>optionalResult(supabase.rpc('crew_recent_activity',{p_ids:ids})),enabled:ids.length>0,retry:false});
  function filter(key,value){const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);setParams(next);}
  return <div className="crews-page">
    <header className="crews-heading"><div><h1>크루</h1><p>같은 종목, 가까운 동네에서 함께 운동해요.</p></div><Link className="btn btn-primary" to="/crews/new">크루 만들기</Link></header>
    <section className="my-crews"><header className="section-heading"><h2>내 크루</h2><span className="muted">함께하는 나의 운동 공간</span></header>
      {mine.isPending?<p role="status">내 크루를 불러오고 있어요.</p>:mine.isError?<button className="btn btn-ghost" onClick={()=>mine.refetch()}>내 크루 다시 불러오기</button>:!mine.data?.pages.some(p=>p.rows.length)?<p className="empty-state">아직 함께하는 크루가 없어요. 아래에서 내 운동에 맞는 크루를 찾아보세요.</p>:<div className="crew-grid">{mine.data.pages.flatMap(p=>p.rows).filter(r=>r.crews).map(r=><CrewCard key={r.crew_id} crew={r.crews} status={r.status}/>)}</div>}
      {mine.hasNextPage&&<button className="btn btn-ghost" disabled={mine.isFetching} onClick={()=>mine.fetchNextPage()}>내 크루 더 보기</button>}
    </section>
    <section className="crew-recommendation-disclosure"><h2>나에게 맞는 크루 추천</h2><CrewRecommendations /></section>
    <h2 className="crew-browse-title">전체 크루</h2>
    <form className="crew-search" onSubmit={e=>{e.preventDefault();filter('q',search);}}><label><span className="sr-only">크루 이름</span><input type="search" value={search} maxLength={40} onChange={e=>setSearch(e.target.value)} placeholder="크루 이름으로 검색"/></label><label><span className="sr-only">활동 지역</span><select value={filters.region} onChange={e=>filter('region',e.target.value)}><option value="">모든 지역</option>{[...new Set(regions.data?.map(r=>r.sido)||[])].map(s=><option key={s}>{s}</option>)}</select></label><button className="btn btn-primary">검색</button></form>
    <div className="crew-sports" role="group" aria-label="종목 필터">
      {[['','전체'], ...Object.entries(SPORTS)].map(([value,label]) => <button key={value} type="button" aria-pressed={sport === value}
        onClick={() => filter('sport',value)}>{label}</button>)}
    </div>
    {crews.isPending && <p role="status" className="crew-state">크루를 불러오고 있어요.</p>}
    {crews.error && <div className="crew-state" role="alert"><p>크루 목록을 불러오지 못했어요.</p><button className="btn btn-ghost" disabled={crews.isFetching} onClick={() => crews.isFetchNextPageError ? crews.fetchNextPage() : crews.refetch()}>다시 조회</button></div>}
    {!crews.isPending && !crews.error && !rows.length && <div className="empty-state"><h2>조건에 맞는 크루가 없어요</h2><p>이름이나 지역을 바꿔서 찾아보세요.</p><button className="btn btn-ghost" onClick={()=>{setParams({});setSearch('');}}>전체 크루 보기</button><Link className="btn btn-primary" to="/crews/new">크루 만들기</Link></div>}
    <div className="crew-grid">{rows.map(crew => <CrewCard key={crew.id} crew={crew} recent={recent.data?.find(r=>String(r.crew_id)===String(crew.id))?.last_post_at}/>)}</div>
    {crews.hasNextPage && <button className="btn btn-ghost crew-more" disabled={crews.isFetching} onClick={() => crews.fetchNextPage()}>{crews.isFetchingNextPage ? '불러오는 중…' : '크루 더 보기'}</button>}
  </div>;
}
