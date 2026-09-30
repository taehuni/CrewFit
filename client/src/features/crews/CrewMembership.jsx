import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/index.js';
import { api } from '../../shared/api.js';
import { supabase } from '../../shared/supabaseClient.js';
import { queryKeys } from '../../shared/queryKeys.js';
import { leaveCrew } from './crews.js';

export default function CrewMembership({crew}) {
  const {user,token}=useAuth(), cache=useQueryClient();
  const [busy,setBusy]=useState(false), [confirm,setConfirm]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  const running=useRef(false);
  const pending=crew.membership==='pending', joined=crew.membership==='approved';
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({queryKey:queryKeys.crewStatsRoot(user.id,String(crew.id))}),
      cache.invalidateQueries({queryKey:queryKeys.crewDetail(user.id,String(crew.id))}),
      cache.invalidateQueries({queryKey:queryKeys.crewListRoot(user.id)}),
    ]);
  }
  async function act(leaving=false) {
    if(running.current)return;
    running.current=true;setBusy(true);setError('');setMessage('');
    try {
      if(leaving){await leaveCrew(supabase,crew,user.id);setMessage(pending?'가입 요청을 취소했어요.':'크루에서 탈퇴했어요.');}
      else { const result=await api(`/crews/${crew.id}/join`,{token,body:{}});setMessage(result.status==='pending'?'가입을 요청했어요. 크루장의 승인을 기다려 주세요.':'크루에 가입했어요.'); }
      setConfirm(false);
      await refresh();
    }catch(error){setError(error.message);}
    finally{running.current=false;setBusy(false);}
  }
  if(crew.owner_id===user.id)return <p className="crew-form-note">이 크루의 크루장입니다. 크루장은 탈퇴할 수 없어요.</p>;
  return <section className="crew-membership" aria-label="크루 가입 관리" aria-busy={busy}>
    {message && <p role="status">{message}</p>}
    {error && <div role="alert"><p className="crew-error">{error}</p><button className="btn btn-ghost" disabled={busy} onClick={async()=>{setError('');setConfirm(false);await refresh();}}>현재 상태 다시 조회</button></div>}
    {confirm ? <div className="crew-leave-confirm">
      <p>{pending?'가입 요청을 취소할까요?':'크루에서 탈퇴할까요? 크루 전용 글과 공유 기록에 대한 접근이 제한됩니다.'}</p>
      <button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirm(false)}>돌아가기</button>
      <button className="btn btn-primary" disabled={busy} onClick={()=>act(true)}>{busy?'처리 중…':pending?'요청 취소 확인':'탈퇴 확인'}</button>
    </div> : pending || joined ? <>
      {pending && <p>크루장이 가입 요청을 확인하고 있어요.</p>}
      <button className="btn btn-ghost" disabled={busy} onClick={()=>{setConfirm(true);setMessage('');}}>{pending?'가입 요청 취소':'크루 탈퇴'}</button>
    </> : <button className="btn btn-primary" disabled={busy} onClick={()=>act()}>{busy?'처리 중…':crew.join_mode==='open'?'크루 가입하기':'가입 요청하기'}</button>}
  </section>;
}
