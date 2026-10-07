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

// "나" 탭. 프로필 카드·실명(D-28)·크루 추천(D-16)·공개 범위(D-19).
export default function MePage() {
  const { user, token, signOut } = useAuth();
  const me = useQuery({ queryKey: queryKeys.me(user.id), queryFn: () => api('/me', { token }) });

  return (
    <div className="profile-page">
      <div className="page-head">
        <h1>나</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
      </div>
      <div className="stack">
        {me.isPending && <p className="muted">프로필 불러오는 중…</p>}
        {me.isError && <FormMessage>{me.error.message}</FormMessage>}
        {me.data && <MemberOverview profile={{...me.data.profile,id:user.id}}/>}
        {me.data && <RealNameForm key={user.id} userId={user.id} initialName={me.data.settings?.real_name} />}
        {me.data && <MediaEditor/>}
        <CommunitySettings/>
        {me.data && <CrewPreferencesForm key={user.id} userId={user.id} profile={me.data.profile} settings={me.data.settings} />}
        {me.data && <PublicProfileForm key={user.id} userId={user.id} profile={me.data.profile} />}
      </div>
    </div>
  );
}
