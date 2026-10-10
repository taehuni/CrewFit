import { Link } from 'react-router';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { SPORT_LABEL } from '../../shared/ui.jsx';
import { listGpsDrafts, deleteGpsDraft } from './drafts.js';
import { TRACKING_SPORTS } from './tracking.js';
import './tracking.css';
export default function GpsDraftList({ date, sport, onSelect }) {
  const {user} = useAuth();
  const cache = useQueryClient(), lock = useRef(false);
  const [confirmId, setConfirmId] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const drafts = useQuery({queryKey:queryKeys.gpsDrafts(user.id,{date:date || '',sport:sport || ''}),
    queryFn:({signal})=>listGpsDrafts(supabase,user.id,{date,sport},signal),
    enabled:!sport || TRACKING_SPORTS.includes(sport),gcTime:0});
  async function remove(id) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await deleteGpsDraft(supabase, user.id, id);
      setConfirmId(null);
      await cache.invalidateQueries({queryKey:queryKeys.gpsDraftsRoot(user.id)});
    } catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  }
  if (sport && !TRACKING_SPORTS.includes(sport)) return null;
  if (drafts.isPending) return <p role="status">보관한 GPS 측정 확인 중…</p>;
  if (drafts.isError) return <p className="muted">보관한 GPS 측정을 불러오지 못했어요. <button type="button" onClick={()=>drafts.refetch()}>다시 확인</button></p>;
  if (!drafts.data?.length) return null;
  return <section className="gps-drafts" aria-label="보관한 GPS 측정"><h2>
    {date ? '이날 보관한 GPS 측정' : '보관한 GPS 측정'} · {drafts.data.length}{drafts.data.length===50 ? '+' : ''}건</h2>
    <div>
    <p>아직 운동 기록에 포함되지 않은 측정이에요. 불러와 저장하면 기록에 반영돼요.</p>
    <ul>{drafts.data.map(draft=><li key={draft.id}><div><strong>{SPORT_LABEL[draft.sport]} · {draft.performed_on}</strong>
      <p>{new Date(draft.started_at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})} · {(draft.distance_m/1000).toFixed(2)}km · {Math.floor(draft.duration_sec/60)}분 {draft.duration_sec%60}초</p></div>
      <div className="gps-draft-actions">{onSelect ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>onSelect(draft.id)}>불러오기</button> : busy ? <button type="button" className="btn btn-ghost" disabled>불러오기</button> : <Link className="btn btn-ghost" to={`/activities/new?gpsDraft=${draft.id}`}>불러오기</Link>}
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{setConfirmId(draft.id);setError('');}}>삭제</button></div>
      {confirmId===draft.id && <div className="gps-draft-confirm" role="group" aria-label="보관한 GPS 삭제 확인"><p>이 측정의 경로·시간·거리를 삭제할까요? 삭제하면 복구할 수 없어요.</p>
        {error && <p role="alert">{error}</p>}
        <div className="gps-draft-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{setConfirmId(null);setError('');}}>취소</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>remove(draft.id)}>{busy ? '삭제 중…' : '측정 삭제'}</button>
        {error && <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>drafts.refetch()}>목록 새로고침</button>}</div></div>}</li>)}</ul>
    {drafts.data.length===50 && <p>최근 50개를 표시해요. 이전 측정은 직접 기록 화면에서 날짜와 종목을 선택해 찾아주세요.</p>}
    </div></section>;
}
