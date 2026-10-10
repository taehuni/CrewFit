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
export default function MePage() {
  const { user, token, signOut } = useAuth();
  const photoInputRef=useRef(null);
  const [searchParams] = useSearchParams();
  const me = useQuery({ queryKey: queryKeys.me(user.id), queryFn: () => api('/me', { token }) });

  useEffect(()=>{if(me.data&&searchParams.has('calendar'))document.getElementById('profile-connections')?.scrollIntoView({block:'start'});},[me.data,searchParams]);
  return (
    <div className="profile-page">
      {searchParams.get("welcome") === "google" && <section className="card stack" aria-label="구글 가입 후 설정"><h2>구글로 로그인했어요. 운동 프로필을 완성해 주세요.</h2><p>아래에서 공개 닉네임을 확인하고 관심 운동과 활동 지역을 설정해 주세요. 구글 캘린더는 아직 연결하지 않았어요.</p><a href="#profile-introduction">닉네임 설정하기 ↓</a><a href="#profile-preferences">관심 운동·지역 설정하기 ↓</a><Link to="/home" className="btn btn-primary">홈으로 이동</Link></section>}
      <div className="page-head">
        <div><span className="section-eyebrow">나의 페이스, 나의 이야기</span><h1>내 프로필</h1><p className="muted small">나를 소개하고, 운동 취향을 정리해 보세요.</p></div>
        <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
      </div>
      <div>
        {me.isPending && <p className="muted">프로필 불러오는 중…</p>}
        {me.isError && <FormMessage>{me.error.message}</FormMessage>}
        {me.data && <div className="profile-layout"><aside className="profile-summary"><MemberOverview onPhotoClick={()=>photoInputRef.current?.click()} profile={{...me.data.profile,id:user.id}}/><MediaEditor mode="photo" photoInputRef={photoInputRef}/><Link className="profile-preview-link" to={`/users/${user.id}`}>내 회원 페이지 보기 <span aria-hidden="true">↗</span></Link><nav className="profile-shortcuts" aria-label="프로필 바로가기"><a href="#profile-introduction">자기소개와 닉네임 <span>01</span></a><a href="#profile-preferences">나의 운동 취향 <span>02</span></a><a href="#profile-privacy">이름·커뮤니티 관리 <span>03</span></a><a href="#profile-connections">연결 서비스 <span>04</span></a></nav><p className="profile-summary-note">공개 프로필에는 닉네임과 소개가 표시돼요.<br/>실명은 공개되지 않아요.</p></aside><div className="profile-settings-column">
          <section id="profile-introduction" className="profile-section"><header><span>01</span><div><h2>나를 소개해요</h2><p>크루원에게 보여줄 소개와 닉네임.</p></div></header><MediaEditor mode="bio"/><PublicProfileForm key={user.id} userId={user.id} profile={me.data.profile}/></section>
          <section id="profile-preferences" className="profile-section"><header><span>02</span><div><h2>나의 운동 취향</h2><p>나에게 맞는 크루를 찾는 기준이에요.</p></div></header><CrewPreferencesForm key={user.id} userId={user.id} profile={me.data.profile} settings={me.data.settings}/></section>
          <section id="profile-privacy" className="profile-section"><header><span>03</span><div><h2>이름·커뮤니티 관리</h2><p>실명과 차단·신고 내역을 관리해요.</p></div></header><RealNameForm key={user.id} userId={user.id} initialName={me.data.settings?.real_name}/><CommunitySettings/></section>
          <section id="profile-connections" className="profile-section"><header><span>04</span><div><h2>연결 서비스</h2><p>운동 계획을 일상에서 이어가세요.</p></div></header><ConnectedServices/></section>
        </div></div>}
      </div>
    </div>
  );
}





