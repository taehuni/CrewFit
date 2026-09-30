import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { queryKeys } from '../../shared/queryKeys.js';

export default function CrewStats({ crewId }) {
  const {user, token} = useAuth();
  const [period, setPeriod] = useState('week');
  const query = useQuery({queryKey:queryKeys.crewStats(user.id, String(crewId), period),
    queryFn:()=>api(`/crews/${crewId}/stats?period=${period}`, {token}), retry:false, staleTime:0, gcTime:0});
  const data = query.data;
  return <section className="crew-stats" aria-labelledby="crew-stats-title">
    <header className="crews-heading"><h2 id="crew-stats-title">함께 쌓은 운동</h2>
      <div className="crew-stats-controls"><div className="crew-sports" role="group" aria-label="크루 통계 기간">
        {[['week','이번 주'],['month','이번 달']].map(([value,label])=><button key={value} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{label}</button>)}
      </div><button className="btn btn-ghost" disabled={query.isFetching} onClick={()=>query.refetch()}>새로고침</button></div>
    </header>
    {query.isFetching ? <p role="status">크루 통계를 불러오고 있어요.</p> : query.isError ? <p className="crew-error" role="alert">{query.error.message} 위 새로고침으로 다시 시도해 주세요.</p> : data?.hidden ?
      <p className="crew-stats-hidden">이 기간에 집계 가능한 운동을 기록한 크루원이 3명 이상일 때 통계가 표시돼요. 개인 기록을 추정하지 못하도록 합계를 숨깁니다.</p> : data && <>
        <p className="crew-match-note">{data.period_start.replaceAll('-', '.')} — {data.period_end.replaceAll('-', '.')} · 운동한 크루원 {data.contributing_members}명</p>
        <dl className="crew-stats-totals">
          <div><dt>운동 횟수</dt><dd><strong>{data.activity_count.toLocaleString()}</strong><span>회</span></dd></div>
          <div><dt>총 거리</dt><dd><strong>{(data.distance_m / 1000).toLocaleString(undefined,{maximumFractionDigits:1})}</strong><span>km</span></dd></div>
          <div><dt>총 시간</dt><dd><strong>{Math.floor(data.duration_sec/3600)}:{String(Math.floor(data.duration_sec%3600/60)).padStart(2,'0')}</strong><span>시간:분</span></dd></div>
        </dl>
      </>}
    <p className="crew-form-note">현재 승인된 크루원의 전체 종목 합계입니다. 나만 공개 기록은 제외하며 개인별 기록은 표시하지 않아요.</p>
  </section>;
}
