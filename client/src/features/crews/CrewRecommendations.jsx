import {Link} from 'react-router';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {api} from '../../shared/api.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {SPORTS} from './crews.js';
import {CrewCover} from '../../shared/CommunityMedia.jsx';
import './crew-recommendations.css';
const labels={sport:'관심 운동',region:'활동 지역',days:'활동 요일',level:'운동 수준'};
const reasons={sport:'관심 운동이 같아요',region:'활동 지역이 같아요',days:'활동 요일이 겹쳐요',level:'운동 수준이 같아요'};
function MatchReasons({crew}){const matches=(crew.matched_on||[]).filter(key=>reasons[key]);return <span className="crew-match-reasons">{matches.length?matches.map(key=><span key={key}>{reasons[key]}</span>):<span>새로운 운동도 둘러보세요</span>}</span>;}
function MatchState({query}){
 if(query.isPending)return <p className="crew-match-state" role="status">관심 설정에 맞는 크루를 찾고 있어요.</p>;
 if(query.isError)return query.error.code==='SETTINGS_REQUIRED'?<div className="crew-match-state"><strong>관심 설정부터 확인해 주세요</strong><p>관심 운동·지역·요일을 추천에 반영해요.</p><Link to="/me/edit#profile-preferences">관심 설정하기 →</Link></div>:<div className="crew-match-state" role="alert"><strong>추천을 불러오지 못했어요</strong><p>잠시 후 다시 시도해 주세요.</p><button type="button" onClick={()=>query.refetch()} disabled={query.isFetching}>{query.isFetching?'다시 찾는 중…':'다시 불러오기'}</button></div>;
 if(!query.data?.crews.length)return <div className="crew-match-state"><strong>아직 추천할 크루가 없어요</strong><p>가입했거나 가입 신청 중인 크루는 제외돼요. 관심 설정을 바꾸거나 전체 목록을 살펴보세요.</p><Link to="/me/edit#profile-preferences">관심 설정 바꾸기 →</Link></div>;
 return null;
}
function RelaxedNote({keys=[]}){const names=keys.map(key=>labels[key]).filter(Boolean);return names.length?<p className="crew-match-relaxed">{names.join(' · ')} 조건을 넓혀 찾았어요. 카드에서 맞는 조건을 확인해 보세요.</p>:null;}

export default function CrewRecommendations({compact=false}){
 const {user,token}=useAuth();
 const query=useQuery({queryKey:queryKeys.crewMatches(user.id),queryFn:()=>api('/crews/match',{token}),retry:false,staleTime:0,refetchOnMount:'always',refetchOnWindowFocus:false,refetchOnReconnect:false});
 if(compact)return <section className="crew-sidebar-suggestions" aria-label="추천 크루"><header><h2>이런 크루는 어때요?</h2><Link to="/me/edit#profile-preferences">관심 설정</Link></header><p>내 관심 설정을 바탕으로 찾아봤어요.</p><MatchState query={query}/>{query.isSuccess&&!!query.data.crews.length&&<><RelaxedNote keys={query.data.relaxed}/><div>{query.data.crews.slice(0,3).map(crew=><Link className="crew-sidebar-mini" key={crew.id} to={'/crews/'+crew.id}><CrewCover crew={crew} compact/><span><small>{SPORTS[crew.sport]} · {crew.member_count}명</small><strong>{crew.name}</strong><small>{crew.region_sigungu||crew.region_sido||'지역 미설정'}</small><MatchReasons crew={crew}/></span><b aria-hidden="true">›</b></Link>)}</div><small className="crew-match-footnote">가입·신청한 크루는 제외돼요.</small></>}</section>;
 return <section className="crew-recommendations" aria-labelledby="crew-recommendation-title">
 <header className="crews-heading"><div><span className="section-eyebrow">FOR YOUR PACE</span><h2 id="crew-recommendation-title">나에게 맞는 크루</h2><p className="crew-recommendation-hint">마음에 드는 크루를 눌러 자세히 살펴보세요.</p></div><Link to="/me/edit#profile-preferences">추천 설정</Link></header>
 <MatchState query={query}/>{query.isSuccess&&!!query.data.crews.length&&<>
 <RelaxedNote keys={query.data.relaxed}/>
 {!query.data.crews.length?<p>아직 추천할 크루가 없어요. 가입·신청한 크루는 추천에서 제외돼요. 아래 전체 목록도 살펴보세요.</p>:<><p className="crew-recommendation-scroll-hint">추천 {query.data.crews.length}개 · 옆으로 넘겨보기 →</p><div className="crew-recommendation-rail" aria-label="추천 크루 목록" tabIndex={0}>
 {query.data.crews.map(crew=><Link key={crew.id} to={'/crews/'+crew.id} className="crew-recommendation-card"><div className="crew-recommendation-image"><CrewCover crew={crew} compact/><span className="crew-recommendation-type">크루 · {SPORTS[crew.sport]}</span></div><div className="crew-recommendation-body"><h3>{crew.name}</h3><p className="crew-recommendation-meta">{crew.region_sigungu||crew.region_sido||'지역 미설정'} · {crew.member_count}명</p><MatchReasons crew={crew}/><div className="crew-recommendation-footer"><span>{crew.join_mode==='open'?'바로 가입 가능':'승인 후 가입'}</span><span>둘러보기 <span aria-hidden="true">↗</span></span></div></div></Link>)}
 </div></>}
 </>}
 </section>;
}
