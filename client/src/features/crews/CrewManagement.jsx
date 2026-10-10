import { useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { loadCrewMembers, updateCrewMember } from './crewManagement.js';
import {MemberAvatar} from '../../shared/CommunityMedia.jsx';

export default function CrewManagement({ crew }) {
  const { user, token } = useAuth(), cache = useQueryClient();
  const [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const running = useRef(false);
  const key = queryKeys.crewMembers(user.id, String(crew.id));
  const query = useInfiniteQuery({ queryKey: key, initialPageParam: 0,
    queryFn: ({ pageParam }) => loadCrewMembers(supabase, crew, user.id, pageParam),
    getNextPageParam: page => page.next, gcTime: 0, staleTime: 0, retry: false,
    enabled: crew.owner_id === user.id,
  });
  async function refresh() {
    setConfirmation(null);
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: queryKeys.crewStatsRoot(user.id, String(crew.id)) }),
      cache.invalidateQueries({ queryKey: queryKeys.crewDetail(user.id, String(crew.id)) }),
      cache.invalidateQueries({ queryKey: queryKeys.crewListRoot(user.id) }),
    ]);
  }
  async function act(member, action) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (action === 'approve' || action === 'reject')
        await api(`/crews/${crew.id}/${action}`, { token, body: { user_id: member.user_id } });
      else await updateCrewMember(supabase, crew, user.id, member, action);
      setMessage({ approve: '가입을 승인했어요.', reject: '가입 요청을 거절했어요.', kick: '크루에서 내보냈어요.', permission: '글 작성 권한을 변경했어요.' }[action]);
      // Remove cached names immediately after a membership change; reload authoritative state.
      cache.setQueryData(key, { pages: [], pageParams: [] });
      await refresh();
    } catch (cause) { setError(cause.message); }
    finally { running.current = false; setBusy(false); }
  }
  if (crew.owner_id !== user.id) return null;
  const members = query.data?.pages.flatMap(page => page.members) || [];
  return <section className="crew-management" aria-label="크루장 관리" aria-busy={busy}>
    <header><h2>크루원 관리</h2><button className="btn btn-ghost" disabled={busy || query.isFetching} onClick={refresh}>새로고침</button></header>
    <p className="crew-form-note">이름은 승인된 크루원에 한해 크루장에게만 표시됩니다.</p>
    {message && <p role="status">{message}</p>}
    {error && <p className="crew-error" role="alert">{error}</p>}
    {query.isPending ? <p role="status">회원 목록을 불러오고 있어요.</p> : query.isError ? <p role="alert">회원 목록을 불러오지 못했어요. 새로고침해 주세요.</p> : <>
      {['pending', 'approved'].map(status => <section key={status} className="crew-member-group">
        <h3>{status === 'pending' ? '가입 요청' : '함께하는 크루원'} <span className="crew-group-count">{members.filter(m=>m.status===status).length}{query.hasNextPage?'+':''}</span></h3>
        {!members.some(member => member.status === status) && <p>{status === 'pending' ? '불러온 목록에 대기 중인 요청이 없어요.' : '불러온 목록에 가입한 크루원이 없어요.'}</p>}
        <ul>{members.filter(member => member.status === status).map(member => <li key={member.user_id}>
          <div className="crew-managed-person"><MemberAvatar id={member.user_id} name={member.nickname}/><div><span className="person-role-label">회원 닉네임</span><strong>{member.nickname}</strong>{status === 'approved' && <span className="crew-member-name">실명 · {member.real_name || '미등록'}</span>}</div></div>
          {member.user_id === user.id ? <span>크루장</span> : <div className="crew-member-actions">
            {status === 'pending' ? <><button className="btn btn-primary" disabled={busy} onClick={() => act(member, 'approve')}>승인</button><button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmation({member, action:'reject'})}>거절</button></> : <>
              <button className="btn btn-ghost" aria-pressed={member.can_post} disabled={busy} onClick={() => act(member, 'permission')}>글 작성 {member.can_post ? '허용됨' : '제한됨'}</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmation({member, action:'kick'})}>내보내기</button>
            </>}
          </div>}
        </li>)}</ul>
      </section>)}
      {query.hasNextPage && <button className="btn btn-ghost" disabled={busy || query.isFetching} onClick={() => query.fetchNextPage()}>회원 더 보기</button>}
    </>}
    {confirmation && <div className="crew-leave-confirm" role="group" aria-label="회원 관리 확인">
      <p>{confirmation.member.nickname} 님{confirmation.action === 'kick' ? '을 크루에서 내보낼까요? 크루 전용 콘텐츠 접근 권한을 잃습니다.' : '의 가입 요청을 거절할까요?'}</p>
      <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmation(null)}>취소</button>
      <button className="btn btn-primary" disabled={busy} onClick={() => act(confirmation.member, confirmation.action)}>{busy ? '처리 중…' : '확인'}</button>
    </div>}
  </section>;
}
