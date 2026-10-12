import {Link} from 'react-router';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {SPORTS} from './crews.js';
import {CrewCover} from '../../shared/CommunityMedia.jsx';
import './crew-recommendations.css';
const labels={sport:'종목',region:'지역',days:'요일',level:'레벨'};
export default function CrewRecommendations(){
 const {user,token}=useAuth();
 const query=useQuery({queryKey:queryKeys.crewMatches(user.id),queryFn:()=>api('/crews/match',{token}),retry:false,staleTime:0});
 return <section className="crew-recommendations" aria-labelledby="crew-recommendation-title">
 <header className="crews-heading"><div><span className="section-eyebrow">FOR YOUR PACE</span><h2 id="crew-recommendation-title">나에게 맞는 크루</h2><p className="crew-recommendation-hint">마음에 드는 크루를 눌러 자세히 살펴보세요.</p></div><Link to="/me#crew-preferences">추천 설정</Link></header>
 {query.isPending?<p role="status">내 설정에 맞는 크루를 찾고 있어요.</p>:query.isError?query.error.code==='SETTINGS_REQUIRED'?<p>관심 운동과 활동 지역을 설정하면 크루 추천에 반영돼요. <Link to="/me#crew-preferences">관심 운동 설정하기</Link></p>:<div role="alert"><p>추천을 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>query.refetch()} disabled={query.isFetching}>다시 조회</button></div>:<>
 {!!query.data.relaxed.length&&<p className="crew-match-note">모든 조건에 맞는 크루가 없어 {query.data.relaxed.map(key=>labels[key]).join(' · ')} 조건을 넓혔어요.</p>}
 {!query.data.crews.length?<p>아직 추천할 크루가 없어요. 가입·신청한 크루는 추천에서 제외돼요. 아래 전체 목록도 살펴보세요.</p>:<><p className="crew-recommendation-scroll-hint">추천 {query.data.crews.length}개 · 옆으로 넘겨보기 →</p><div className="crew-recommendation-rail" aria-label="추천 크루 목록" tabIndex={0}>
 {query.data.crews.map(crew=><Link key={crew.id} to={'/crews/'+crew.id} className="crew-recommendation-card"><div className="crew-recommendation-image"><CrewCover crew={crew} compact/><span className="crew-recommendation-type">크루 · {SPORTS[crew.sport]}</span></div><div className="crew-recommendation-body"><h3>{crew.name}</h3><p className="crew-recommendation-meta">{crew.region_sigungu||crew.region_sido||'지역 미설정'} · {crew.member_count}명</p><p className="crew-recommendation-reason">{crew.matched_on.length?crew.matched_on.map(key=>labels[key]).join(' · ')+'이 맞아요':'새로운 운동 크루를 만나보세요'}</p><div className="crew-recommendation-footer"><span>{crew.join_mode==='open'?'바로 가입 가능':'승인 후 가입'}</span><span>둘러보기 <span aria-hidden="true">↗</span></span></div></div></Link>)}
 </div></>}
 </>}
 </section>;
}
