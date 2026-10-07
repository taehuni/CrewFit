import { Link, useParams } from 'react-router';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import { loadMember, loadMemberRecords, loadMemberCrews } from './memberProfile.js';
import './profile.css';
import {MemberOverview} from '../../shared/CommunityMedia.jsx';

function QueryState({ query, empty }) {
  if (query.isPending) return <p role="status">불러오는 중…</p>;
  if (query.isError) return <div role="alert"><p>목록을 불러오지 못했어요.</p><button className="btn btn-ghost" disabled={query.isFetching} onClick={() => query.isFetchNextPageError ? query.fetchNextPage() : query.refetch()}>다시 조회</button></div>;
  if (!query.data?.pages.some(page => page.rows.length)) return <p className="muted">{empty}</p>;
  return null;
}
function MemberContent({ userId, profile }) {
  const options = { initialPageParam: null, getNextPageParam: page => page.next, retry: false, gcTime: 0, staleTime: 0 };
  const records = useInfiniteQuery({ ...options, queryKey: queryKeys.memberRecords(userId, profile.id), queryFn: ({ pageParam, signal }) => loadMemberRecords(supabase, profile.id, pageParam, signal) });
  const crews = useInfiniteQuery({ ...options, queryKey: queryKeys.memberCrews(userId, profile.id), queryFn: ({ pageParam, signal }) => loadMemberCrews(supabase, profile.id, pageParam, signal) });
  return <>
    <MemberOverview profile={profile}/>
    <section className="card stack"><h2>가입 크루</h2><p className="muted">공개 설정에 따라 볼 수 있는 승인된 크루만 표시해요.</p>
      <QueryState query={crews} empty="표시할 수 있는 가입 크루가 없어요." />
      {!crews.isError && <ul className="member-list">{crews.data?.pages.flatMap(page => page.rows).filter(row => row.crews).map(row => <li key={row.crew_id}><Link to={`/crews/${row.crew_id}`}>{row.crews.name}</Link><span>{SPORT_LABEL[row.crews.sport]}</span></li>)}</ul>}
      {crews.hasNextPage && <button className="btn btn-ghost" disabled={crews.isFetching} onClick={() => crews.fetchNextPage()}>크루 더 보기</button>}
    </section>
    <section className="card stack"><h2>볼 수 있는 운동 기록</h2><p className="muted">공개 범위 또는 게시글 첨부로 공유된 기록의 요약이에요. GPS 경로와 개인 메모는 표시하지 않아요.</p>
      <QueryState query={records} empty="기록이 없거나 공개 범위에 따라 볼 수 없어요." />
      {!records.isError && <ul className="member-list">{records.data?.pages.flatMap(page => page.rows).map(row => <li key={row.id}><div><strong>{SPORT_LABEL[row.sport] || '운동'}</strong><p>{row.performed_on}</p></div><div><span>{Math.floor(row.duration_sec / 60)}분 {row.duration_sec % 60}초</span>{row.distance_m != null && <p>{row.sport === 'swimming' ? `${row.distance_m.toLocaleString('ko-KR')} m` : `${(row.distance_m / 1000).toLocaleString('ko-KR')} km`}</p>}</div></li>)}</ul>}
      {records.hasNextPage && <button className="btn btn-ghost" disabled={records.isFetching} onClick={() => records.fetchNextPage()}>기록 더 보기</button>}
    </section>
  </>;
}
export default function MemberPage() {
  const { id } = useParams(), { user } = useAuth();
  const member = useQuery({ queryKey: queryKeys.member(user.id, id), queryFn: ({ signal }) => loadMember(supabase, id, signal), retry: false, gcTime: 0, staleTime: 0 });
  return <div className="stack member-page"><header className="page-head"><h1>회원 프로필</h1><Link to={id === user.id ? '/me' : '/feed'}>{id === user.id ? '프로필 설정' : '피드로'}</Link></header>
    {member.isPending ? <p role="status">회원을 불러오는 중…</p> : member.isError ? <div role="alert"><p>{member.error.message}</p><button className="btn btn-ghost" onClick={() => member.refetch()}>다시 조회</button></div> : !member.data ? <p>회원을 찾을 수 없어요.</p> : <MemberContent key={`${user.id}:${id}`} userId={user.id} profile={member.data} />}
  </div>;
}
