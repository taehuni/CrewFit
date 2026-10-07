import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, dayLabel } from './crews.js';
import CrewMark from '../../shared/CrewMark.jsx';

const labels = { sport: '종목', region: '지역', days: '요일', level: '레벨' };
export default function CrewRecommendations() {
  const { user, token } = useAuth();
  const query = useQuery({ queryKey: queryKeys.crewMatches(user.id), queryFn: () => api('/crews/match', {token}), retry: false, staleTime: 0 });
  return <section className="crew-recommendations" aria-labelledby="crew-recommendation-title">
    <header className="crews-heading"><h2 id="crew-recommendation-title">나에게 맞는 크루</h2><Link to="/me#crew-preferences">추천 설정</Link></header>
    {query.isPending ? <p role="status">내 설정에 맞는 크루를 찾고 있어요.</p> : query.isError ?
      query.error.code === 'SETTINGS_REQUIRED' ? <p>주종목을 설정하면 맞는 크루를 추천해 드려요. <Link to="/me#crew-preferences">주종목 설정하기</Link></p> :
        <div role="alert"><p>추천을 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={() => query.refetch()} disabled={query.isFetching}>다시 조회</button></div> : <>
      {!!query.data.relaxed.length && <p className="crew-match-note">모든 조건에 맞는 크루가 없어 {query.data.relaxed.map(key => labels[key]).join(' · ')} 조건을 넓혔어요. 종목은 같아요.</p>}
      {!query.data.crews.length && <p>아직 추천할 크루가 없어요. 가입·신청한 크루는 추천에서 제외돼요. 아래 전체 목록도 살펴보세요.</p>}
      <div className="crew-grid">{query.data.crews.map(crew => <Link key={crew.id} to={`/crews/${crew.id}`} className="crew-card">
        <div className="crew-card-top"><span>{SPORTS[crew.sport]} · {crew.member_count}명</span><span>{crew.join_mode === 'open' ? '즉시 가입형' : '승인형'}</span></div>
        <div className="crew-identity"><CrewMark name={crew.name} sport={crew.sport}/><h3>{crew.name}</h3></div><p>{crew.region_sido} {crew.region_sigungu}</p>
        <p className="crew-match-note">{crew.matched_on.map(key => labels[key]).join(' · ')} 일치</p>
        <div className="crew-card-bottom"><span>{dayLabel(crew.activity_days)}</span><span>{LEVELS[crew.level] || '레벨 무관'}</span></div>
      </Link>)}</div>
    </>}
  </section>;
}
