import {ProfileChangesProvider, useConfirmProfileExit} from './ProfileChanges.jsx';
import ConnectedServices from './ConnectedServices.jsx';
import PosePrivacySettings from '../pose/PosePrivacySettings.jsx';
import { useRef,useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { Button } from '../../shared/ui.jsx';
import PublicProfileForm from './PublicProfileForm.jsx';
import RealNameForm from './RealNameForm.jsx';
import CrewPreferencesForm from './CrewPreferencesForm.jsx';
import {MediaEditor,MemberOverview} from '../../shared/CommunityMedia.jsx';
import {CommunitySettings} from '../social/index.js';
import {Link, useSearchParams, useLocation} from 'react-router';
import './profile-polish.css';

// 프로필 편집과 계정 설정은 각 화면의 목적에 맞는 내용만 보여준다.
export default function ProfileEditor(props) {
  const {user}=useAuth();
  return <ProfileChangesProvider key={user.id}><ProfileEditorContent {...props}/></ProfileChangesProvider>;
}
function ProfileEditorContent({settings=false}) {
  const confirmExit=useConfirmProfileExit();
  const { user, token, signOut } = useAuth();
  const photoInputRef=useRef(null);
  const [searchParams] = useSearchParams();
  const {hash} = useLocation();
  const me = useQuery({ queryKey: queryKeys.me(user.id), queryFn: () => api('/me', { token }) });

  useEffect(()=>{
    if(!me.data)return;
    const target=hash.slice(1)||(searchParams.has('calendar')?'profile-connections':'');
    const allowed=settings?['profile-privacy','profile-analysis','profile-connections']:['profile-introduction','profile-preferences'];
    if(!allowed.includes(target))return;
    const frame=requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView({block:'start'}));
    return ()=>cancelAnimationFrame(frame);
  },[me.data,searchParams,hash,settings]);
  return (
    <div className="profile-page">
      <div className="page-head">
        <div><h1>{settings?'설정':'프로필 편집'}</h1></div>
        <Link className="btn btn-ghost" to="/me">내 프로필로</Link>
      </div>
      <div>
        {me.isPending && <p role="status" className="muted">프로필 불러오는 중…</p>}
        {me.isError && <div role="alert" className="card"><p>프로필을 불러오지 못했어요.</p><Button variant="ghost" disabled={me.isFetching} onClick={()=>me.refetch()}>{me.isFetching?'불러오는 중…':'다시 불러오기'}</Button></div>}
        {me.data && <div className={'profile-layout'+(settings?' is-settings':'')}>{!settings&&<aside className="profile-summary"><MemberOverview onPhotoClick={settings?undefined:()=>photoInputRef.current?.click()} profile={{...me.data.profile,id:user.id}}/>{!settings&&<MediaEditor mode="photo" photoInputRef={photoInputRef}/>}<Link className="profile-preview-link" to={`/users/${user.id}`}>내 회원 페이지 보기 <span aria-hidden="true">↗</span></Link><p className="profile-summary-note">공개 프로필에는 닉네임과 소개가 표시돼요.<br/>실명은 공개되지 않아요.</p></aside>}<div className="profile-settings-column">
          <section hidden={settings} id="profile-introduction" className="profile-section"><header><div><h2>개인 정보</h2></div></header><p className="profile-account-email">로그인 이메일 <strong>{user.email}</strong></p><PublicProfileForm mode="nickname" userId={user.id} profile={me.data.profile}/><RealNameForm userId={user.id} initialName={me.data.settings?.real_name}/><MediaEditor mode="bio"/></section>
          <section hidden={settings} id="profile-preferences" className="profile-section"><header><div><h2>운동 관심·목표</h2></div></header><CrewPreferencesForm key={user.id} userId={user.id} profile={me.data.profile} settings={me.data.settings}/><Link className="btn btn-ghost" to="/goals">나의 운동 목표 관리 ↗</Link></section>
          <section hidden={!settings} id="profile-privacy" className="profile-section"><header><div><h2>공개 범위·커뮤니티</h2></div></header><PublicProfileForm mode="privacy" userId={user.id} profile={me.data.profile}/><CommunitySettings/></section>
          {settings&&<section id="profile-analysis" className="profile-section"><header><div><h2>사진 분석</h2></div></header><PosePrivacySettings expanded/><Link className="btn btn-ghost" to="/pose#pose-history-title">저장한 측정·영상 보기 ↗</Link></section>}
          <section hidden={!settings} id="profile-connections" className="profile-section"><header><div><h2>연결 서비스</h2></div></header><ConnectedServices/><Button variant="ghost" onClick={()=>{if(confirmExit())void signOut();}}>로그아웃</Button></section>
        </div></div>}
      </div>
    </div>
  );
}





