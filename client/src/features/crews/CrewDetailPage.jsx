import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, dayLabel, loadCrew } from './crews.js';
import './crews.css';

export default function CrewDetailPage() {
  const { user } = useAuth(), {crewId} = useParams();
  const query = useQuery({queryKey:queryKeys.crewDetail(user.id,crewId),queryFn:()=>loadCrew(supabase,crewId,user.id),retry:false});
  const crew = query.data;
  return <div className="crews-page">
    <header className="crews-heading"><h1>크루 상세</h1><Link to="/crews">크루 목록</Link></header>
    {query.isPending ? <p role="status">크루를 불러오고 있어요.</p> : query.error ? <div role="alert"><p>크루 정보를 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 조회</button></div>
      : !crew ? <p>크루를 찾을 수 없어요. 삭제되었거나 잘못된 주소입니다.</p>
      : <><section className="crew-detail-hero"><p>{SPORTS[crew.sport]} · {crew.region_sido} {crew.region_sigungu}</p><h2>{crew.name}</h2>
          <div><span>{crew.member_count}명</span><span>{LEVELS[crew.level] || '레벨 무관'}</span><span>{crew.join_mode==='open' ? '즉시 가입형' : '승인형'}</span></div></section>
        <div className="crew-detail-body"><section><h2>크루 소개</h2><p className="crew-description">{crew.description || '아직 소개가 등록되지 않았어요.'}</p></section>
          <section><h2>활동 정보</h2><dl><dt>활동 요일</dt><dd>{dayLabel(crew.activity_days)}</dd><dt>크루장</dt><dd>{crew.owner_nickname}</dd><dt>내 상태</dt><dd>{crew.owner_id===user.id ? '크루장' : crew.membership==='approved' ? '크루원' : crew.membership==='pending' ? '승인 대기' : '가입 전'}</dd></dl>
          <p className="crew-form-note">가입·승인과 멤버 관리는 다음 단계에서 연결됩니다.</p></section></div></>}
  </div>;
}
