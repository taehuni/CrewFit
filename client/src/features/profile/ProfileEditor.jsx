import ConnectedServices from './ConnectedServices.jsx';
import { useRef,useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { Button, FormMessage } from '../../shared/ui.jsx';
import PublicProfileForm from './PublicProfileForm.jsx';
import RealNameForm from './RealNameForm.jsx';
import CrewPreferencesForm from './CrewPreferencesForm.jsx';
import {MediaEditor,MemberOverview} from '../../shared/CommunityMedia.jsx';
import {CommunitySettings} from '../social/index.js';
import {Link, useSearchParams} from 'react-router';
import './profile-polish.css';

// "나" 탭. 프로필 카드·실명(D-28)·크루 추천(D-16)·공개 범위(D-19).
export default function ProfileEditor({settings=false}) {
  const { user, token, signOut } = useAuth();
  const photoInputRef=useRef(null);
  const [searchParams] = useSearchParams();
  const me = useQuery({ queryKey: queryKeys.me(user.id), queryFn: () => api('/me', { token }) });

  useEffect(()=>{if(me.data&&searchParams.has('calendar'))document.getElementById('profile-connections')?.scrollIntoView({block:'start'});},[me.data,searchParams]);
  return (
    <div className="profile-page">
      <div className="page-head">
        <div><span className="section-eyebrow">나의 페이스, 나의 이야기</span><h1>{settings?'설정':'프로필 편집'}</h1><p className="muted small">나를 소개하고, 운동 취향을 정리해 보세요.</p></div>
        <Link className="btn btn-ghost" to="/me">내 프로필로</Link>
      </div>
      <div>
        {me.isPending && <p className="muted">프로필 불러오는 중…</p>}
        {me.isError && <FormMessage>{me.error.message}</FormMessage>}
        {me.data && <div className="profile-layout"><aside className="profile-summary"><MemberOverview onPhotoClick={settings?undefined:()=>photoInputRef.current?.click()} profile={{...me.data.profile,id:user.id}}/>{!settings&&<MediaEditor mode="photo" photoInputRef={photoInputRef}/>}<Link className="profile-preview-link" to={`/users/${user.id}`}>내 회원 페이지 보기 <span aria-hidden="true">↗</span></Link><nav hidden className="profile-shortcuts" aria-label="프로필 바로가기"><a href="#profile-introduction">개인 정보 <span>01</span></a><a href="#profile-preferences">운동 관심·목표 <span>02</span></a><a href="#profile-privacy">공개 범위·커뮤니티 <span>03</span></a><a href="#profile-connections">연결 서비스 <span>04</span></a></nav><p className="profile-summary-note">공개 프로필에는 닉네임과 소개가 표시돼요.<br/>실명은 공개되지 않아요.</p></aside><div className="profile-settings-column">
          <section hidden={settings} id="profile-introduction" className="profile-section"><header><span>01</span><div><h2>개인 정보</h2><p>계정 정보와 나를 소개하는 내용을 모았어요.</p></div></header><p className="profile-account-email">로그인 이메일 <strong>{user.email}</strong></p><PublicProfileForm mode="nickname" key={user.id} userId={user.id} profile={me.data.profile}/><RealNameForm key={user.id} userId={user.id} initialName={me.data.settings?.real_name}/><MediaEditor mode="bio"/></section>
          <section hidden={settings} id="profile-preferences" className="profile-section"><header><span>02</span><div><h2>운동 관심·목표</h2><p>좋아하는 운동과 활동 여건을 설정해요.</p></div></header><CrewPreferencesForm key={user.id} userId={user.id} profile={me.data.profile} settings={me.data.settings}/><Link className="btn btn-ghost" to="/goals">나의 운동 목표 관리 ↗</Link></section>
          <section hidden={!settings} id="profile-privacy" className="profile-section"><header><span>03</span><div><h2>공개 범위·커뮤니티</h2><p>기록 공개 범위와 차단·신고 내역을 관리해요.</p></div></header><PublicProfileForm mode="privacy" userId={user.id} profile={me.data.profile}/><CommunitySettings/></section>
          <section hidden={!settings} id="profile-connections" className="profile-section"><header><span>04</span><div><h2>연결 서비스</h2><p>운동 계획을 일상에서 이어가세요.</p></div></header><ConnectedServices/><Button variant="ghost" onClick={signOut}>로그아웃</Button></section>
        </div></div>}
      </div>
    </div>
  );
}





