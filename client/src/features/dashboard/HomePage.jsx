import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { Button, Empty, FormMessage } from '../../shared/ui.jsx';

const SPORT = { running: '러닝', walking: '걷기', cycling: '자전거', swimming: '수영', gym: '헬스', other: '기타' };
const LEVEL = { beginner: '입문', intermediate: '중급', advanced: '상급' };

// 구현 ① 범위: /api/me 로 프로필을 받아 배번표로 보여주는 것까지. 통계·스트릭·목표는 ②에서 /api/dashboard.
export default function HomePage() {
  const { user, token, signOut } = useAuth();
  const me = useQuery({ queryKey: queryKeys.me(user.id), queryFn: () => api('/me', { token }) });

  return (
    <>
      <div className="page-head">
        <h1>홈</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>로그아웃</Button>
      </div>
      <div className="stack">
        {me.isPending && <p className="muted">프로필 불러오는 중…</p>}
        {me.isError && <FormMessage>{me.error.message}</FormMessage>}
        {me.data && (
          <section className="bib" aria-label="내 배번표">
            <p className="small muted">CrewFit 배번표</p>
            <p className="bib-name" translate="no">{me.data.profile.nickname}</p>
            <p className="bib-meta">
              <span>{SPORT[me.data.profile.main_sport] || '주종목 미설정'}</span>
              <span>{LEVEL[me.data.profile.level] || '레벨 미설정'}</span>
              {me.data.settings?.region_sigungu && <span>{me.data.settings.region_sido} {me.data.settings.region_sigungu}</span>}
            </p>
            <span className="bib-stripe" aria-hidden="true" />
          </section>
        )}
        <Empty title="아직 기록이 없어요">첫 운동을 기록하면 여기에 이번 주 통계와 스트릭이 보여요.</Empty>
      </div>
    </>
  );
}
