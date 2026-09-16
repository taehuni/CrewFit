import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { ProfileCard, Button, Empty, FormMessage, bibNumber } from '../../shared/ui.jsx';
import RealNameForm from './RealNameForm.jsx';

// "나" 탭. 프로필 카드·로그아웃·실명 입력(D-28). 나머지 프로필 설정은 ④에서 추가.
export default function MePage() {
  const { user, token, signOut } = useAuth();
  const me = useQuery({ queryKey: queryKeys.me(user.id), queryFn: () => api('/me', { token }) });

  return (
    <>
      <div className="page-head">
        <h1>나</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
      </div>
      <div className="stack">
        {me.isPending && <p className="muted">프로필 불러오는 중…</p>}
        {me.isError && <FormMessage>{me.error.message}</FormMessage>}
        {me.data && (
          <ProfileCard
            number={bibNumber(user.id)}
            nickname={me.data.profile.nickname}
            sport={me.data.profile.main_sport}
            level={me.data.profile.level}
            region={me.data.settings?.region_sigungu && `${me.data.settings.region_sido} ${me.data.settings.region_sigungu}`}
          />
        )}
        {me.data && <RealNameForm key={user.id} userId={user.id} initialName={me.data.settings?.real_name} />}
        <Empty title="다른 프로필 설정은 준비 중이에요">주종목·레벨·지역·기록 공개 범위 설정이 구현 ④ 단계에서 들어와요.</Empty>
      </div>
    </>
  );
}
