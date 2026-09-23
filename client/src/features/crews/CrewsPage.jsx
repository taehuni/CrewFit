import { Link, useSearchParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, dayLabel, loadCrews } from './crews.js';
import './crews.css';

export default function CrewsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const sport = params.get('sport') || '';
  const crews = useInfiniteQuery({ queryKey: queryKeys.crewList(user.id, sport), initialPageParam: null,
    queryFn: ({ pageParam }) => loadCrews(supabase, sport, pageParam), getNextPageParam: page => page.nextCursor, retry: false });
  const rows = crews.data?.pages.flatMap(page => page.rows) || [];
  return <div className="crews-page">
    <header className="crews-heading"><div><h1>크루</h1><p>같은 종목, 가까운 동네에서 함께 운동해요.</p></div><Link className="btn btn-primary" to="/crews/new">크루 만들기</Link></header>
    <div className="crew-sports" role="group" aria-label="종목 필터">
      {[['','전체'], ...Object.entries(SPORTS)].map(([value,label]) => <button key={value} type="button" aria-pressed={sport === value}
        onClick={() => setParams(value ? {sport:value} : {})}>{label}</button>)}
    </div>
    {crews.isPending && <p role="status" className="crew-state">크루를 불러오고 있어요.</p>}
    {crews.error && <div className="crew-state" role="alert"><p>크루 목록을 불러오지 못했어요.</p><button className="btn btn-ghost" disabled={crews.isFetching} onClick={() => crews.isFetchNextPageError ? crews.fetchNextPage() : crews.refetch()}>다시 조회</button></div>}
    {!crews.isPending && !crews.error && !rows.length && <div className="crew-state"><h2>아직 등록된 크루가 없어요.</h2><p>첫 크루를 만들고 활동 지역과 요일을 정해보세요.</p><Link to="/crews/new">크루 만들기</Link></div>}
    <div className="crew-grid">{rows.map(crew => <Link key={crew.id} to={`/crews/${crew.id}`} className="crew-card">
      <div className="crew-card-top"><span>{SPORTS[crew.sport]}</span><span>{crew.owner_id === user.id ? '내가 만든 크루' : crew.join_mode === 'open' ? '즉시 가입형' : '승인형'}</span></div>
      <h2>{crew.name}</h2><p>{crew.region_sido} {crew.region_sigungu}</p>
      <p className="crew-card-description">{crew.description || '등록된 소개가 없어요.'}</p>
      <div className="crew-card-bottom"><span>{dayLabel(crew.activity_days)}</span><span>{LEVELS[crew.level] || '레벨 무관'}</span></div>
    </Link>)}</div>
    {crews.hasNextPage && <button className="btn btn-ghost crew-more" disabled={crews.isFetching} onClick={() => crews.fetchNextPage()}>{crews.isFetchingNextPage ? '불러오는 중…' : '크루 더 보기'}</button>}
  </div>;
}
