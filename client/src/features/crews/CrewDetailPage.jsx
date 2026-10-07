import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, dayLabel, loadCrew } from './crews.js';
import './crews.css';
import CrewMembership from './CrewMembership.jsx';
import CrewManagement from './CrewManagement.jsx';
import CrewStats from './CrewStats.jsx';
import CrewMark from '../../shared/CrewMark.jsx';
import { CrewFeed } from '../feed/index.js';
import {CrewCover,MediaEditor} from '../../shared/CommunityMedia.jsx';

export default function CrewDetailPage() {
  const { user } = useAuth(), {crewId} = useParams();
  const query = useQuery({queryKey:queryKeys.crewDetail(user.id,crewId),queryFn:()=>loadCrew(supabase,crewId,user.id),retry:false,staleTime:0});
  const crew = query.data;
  return <div className="crews-page crew-home">
    <header className="crews-heading"><h1>크루 상세</h1><Link to="/crews">크루 목록</Link></header>
    {query.isPending ? <p role="status">크루를 불러오고 있어요.</p> : query.error ? <div role="alert"><p>크루 정보를 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 조회</button></div>
      : !crew ? <p>크루를 찾을 수 없어요. 삭제되었거나 잘못된 주소입니다.</p>
      : <><section className="crew-header-card"><CrewCover crew={crew}/><div className="crew-header-content"><div className="crew-identity"><CrewMark name={crew.name} sport={crew.sport} large/><div><p className="eyebrow">{SPORTS[crew.sport]} · {crew.region_sido} {crew.region_sigungu}</p><h2>{crew.name}</h2><p className="muted small">{crew.member_count}명 · {LEVELS[crew.level] || '레벨 무관'} · {dayLabel(crew.activity_days)}</p></div></div><div className="crew-header-action">{crew.membership==='approved'?<span className="membership-badge">{crew.owner_id===user.id?'내가 운영하는 크루':'함께하는 크루'}</span>:<CrewMembership key={crew.id} crew={crew}/>}</div></div></section>
        <CrewStats key={crew.id} crewId={crew.id} />
        <div className="crew-content-layout"><div className="crew-main-feed">
        <CrewFeed key={crew.id} embeddedCrewId={crew.id}/>
        </div><aside className="crew-sidebar"><div className="crew-detail-body"><section><h2>크루 소개</h2><p className="crew-description">{crew.description || '아직 소개가 등록되지 않았어요.'}</p></section>
          <section><h2>활동 정보</h2><dl><dt>활동 요일</dt><dd>{dayLabel(crew.activity_days)}</dd><dt>크루장</dt><dd>{crew.owner_nickname}</dd><dt>내 상태</dt><dd>{crew.owner_id===user.id ? '크루장' : crew.membership==='approved' ? '크루원' : crew.membership==='pending' ? '승인 대기' : '가입 전'}</dd></dl>
          {crew.membership==='approved'&&<CrewMembership key={crew.id} crew={crew}/>}</section></div></aside></div>
        {crew.owner_id === user.id && <details className="card crew-owner-tools"><summary>크루 관리</summary><MediaEditor crew={crew}/><CrewManagement key={`${user.id}:${crew.id}`} crew={crew} /></details>}</>}
  </div>;
}
