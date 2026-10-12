import { Link, useParams } from 'react-router';
import {useState} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORTS, LEVELS, dayLabel, loadCrew } from './crews.js';
import './crews.css';
import './crew-detail-polish.css';
import CrewMembership from './CrewMembership.jsx';
import CrewManagement from './CrewManagement.jsx';
import CrewStats from './CrewStats.jsx';
import CrewMark from '../../shared/CrewMark.jsx';
import { CrewFeed } from '../feed/index.js';
import {CrewCover,MediaEditor,MemberAvatar} from '../../shared/CommunityMedia.jsx';

export default function CrewDetailPage() {
  const [managementTab,setManagementTab]=useState('members');
  const { user } = useAuth(), {crewId} = useParams();
  const query = useQuery({queryKey:queryKeys.crewDetail(user.id,crewId),queryFn:()=>loadCrew(supabase,crewId,user.id),retry:false,staleTime:0});
  const crew = query.data;
  return <div className="crews-page crew-home crew-detail-polished">
    <header className="crews-heading"><div><span className="section-eyebrow">함께 만드는 운동 습관</span><h1>우리 크루</h1></div><Link to="/crews">← 크루 목록</Link></header>
    {query.isPending ? <p role="status">크루를 불러오고 있어요.</p> : query.error ? <div role="alert"><p>크루 정보를 불러오지 못했어요.</p><button className="btn btn-ghost" onClick={()=>query.refetch()}>다시 조회</button></div>
      : !crew ? <p>크루를 찾을 수 없어요. 삭제되었거나 잘못된 주소입니다.</p>
      : <><section className="crew-header-card"><CrewCover crew={crew}/><div className="crew-header-content"><div className="crew-identity"><CrewMark name={crew.name} sport={crew.sport} large/><div><p className="eyebrow">{SPORTS[crew.sport]} · {crew.region_sido} {crew.region_sigungu}</p><h2>{crew.name}</h2><div className="crew-identity-tags"><span>크루원 {crew.member_count}명</span><span>{LEVELS[crew.level] || '레벨 무관'}</span><span>{crew.join_mode==='open'?'바로 가입':'승인 후 가입'}</span></div></div></div><div className="crew-header-action">{crew.membership==='approved'?<span className="membership-badge">{crew.owner_id===user.id?'내가 운영하는 크루':'함께하는 크루'}</span>:<CrewMembership key={crew.id} crew={crew}/>}</div></div></section>
        <nav className="crew-section-links" aria-label="크루 영역 바로가기"><a href="#crew-progress">운동 현황</a><a href="#crew-stories">크루 피드</a><a href="#crew-about">크루 소개</a>{crew.owner_id===user.id&&<a href="#crew-manage">크루 관리 ↗</a>}</nav>
        <div id="crew-progress"><CrewStats key={crew.id} crewId={crew.id} /></div>
        {crew.owner_id === user.id && <section id="crew-manage" className="crew-admin-panel" aria-label="크루 관리"><header><div><span className="section-eyebrow">크루장 전용</span><h2>크루 관리</h2><p>가입 요청을 확인하고, 함께할 크루원을 관리해요.</p></div><span className="membership-badge">관리 권한 있음</span></header><div className="crew-admin-tabs" role="group" aria-label="관리 메뉴"><button type="button" aria-pressed={managementTab==='members'} onClick={()=>setManagementTab('members')}>회원·가입 요청</button><button type="button" aria-pressed={managementTab==='cover'} onClick={()=>setManagementTab('cover')}>대표 사진 설정</button></div><div hidden={managementTab!=='members'}><CrewManagement key={`${user.id}:${crew.id}`} crew={crew}/></div><div hidden={managementTab!=='cover'}><MediaEditor crew={crew}/></div></section>}

        <div className="crew-content-layout"><div id="crew-stories" className="crew-main-feed">
        <CrewFeed key={crew.id} embeddedCrewId={crew.id}/>
        </div><aside id="crew-about" className="crew-sidebar"><div className="crew-detail-body"><section><span className="section-eyebrow">이런 마음으로 모였어요</span><h2>크루 소개</h2><p className="crew-description">{crew.description || '아직 소개가 등록되지 않았어요.'}</p></section>
          <section><h2>함께하는 사람들</h2><p className="crew-people-summary"><strong>{crew.member_count}명</strong>이 함께 운동하고 있어요.</p><h3 className="crew-info-heading">활동 정보</h3><dl><dt>활동 요일</dt><dd>{dayLabel(crew.activity_days)}</dd><dt>크루장</dt><dd><Link className="crew-leader-link" to={'/users/'+crew.owner_id}><MemberAvatar id={crew.owner_id} name={crew.owner_nickname}/><span>{crew.owner_nickname}<small>회원 프로필 보기 ↗</small></span></Link></dd><dt>내 상태</dt><dd>{crew.owner_id===user.id ? '크루장' : crew.membership==='approved' ? '크루원' : crew.membership==='pending' ? '승인 대기' : '가입 전'}</dd></dl>
          {crew.membership==='approved'&&<CrewMembership key={crew.id} crew={crew}/>}</section></div></aside></div>
        </>}
  </div>;
}
