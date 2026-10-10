import {useState,useRef} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/index.js';
import {supabase} from '../../shared/supabaseClient.js';
import {queryKeys} from '../../shared/queryKeys.js';
import {saveResult} from '../../shared/community.js';

export default function MemberBlockAction({profile}){
 const {user}=useAuth(),cache=useQueryClient(),lock=useRef(false);
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const state=useQuery({queryKey:['community',user.id,'blockState',profile.id],queryFn:async()=>{const r=await supabase.from('member_blocks').select('blocked_id').eq('user_id',user.id).eq('blocked_id',profile.id).maybeSingle();if(r.error)throw r.error;return !!r.data;},enabled:user.id!==profile.id,retry:false});
 if(user.id===profile.id)return null;
 async function change(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');const wasBlocked=state.data;try{
  if(wasBlocked)await saveResult(supabase.from('member_blocks').delete().eq('user_id',user.id).eq('blocked_id',profile.id));
  else{const result=await supabase.from('member_blocks').insert({user_id:user.id,blocked_id:profile.id});if(result.error?.code!=='23505')await saveResult(Promise.resolve(result));}
  await Promise.all([cache.invalidateQueries({queryKey:['community',user.id]}),cache.invalidateQueries({queryKey:queryKeys.postsRoot(user.id)}),cache.invalidateQueries({queryKey:queryKeys.memberRoot(user.id)}),...['direct-chat-rooms','direct-chat-messages','crew-chat-rooms','crew-chat-messages'].map(key=>cache.invalidateQueries({queryKey:[key,user.id]}))]);
  setConfirm(false);setMessage(wasBlocked?'차단을 해제했어요.':'차단했어요. 서로의 게시글·댓글·메시지가 숨겨지고 개인 메시지 전송이 제한됩니다.');
 }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return <section className="member-safety" aria-label="회원 차단 관리">
  <div><strong>{state.data?'차단한 회원':'회원 관리'}</strong><p>{state.data?'서로의 게시글·댓글·메시지가 숨겨져 있어요.':'원하지 않는 교류는 차단으로 관리할 수 있어요.'}</p></div>
  {state.isError?<button className="btn btn-ghost" onClick={()=>state.refetch()}>차단 상태 다시 확인</button>:<button className="btn btn-ghost" disabled={busy||state.isPending||state.isFetching} onClick={()=>{setConfirm(true);setError('');setMessage('');}}>{state.isPending?'확인 중…':state.data?'차단 해제':'회원 차단'}</button>}
  {confirm&&<div className="member-block-confirm" role="group" aria-label="회원 차단 확인"><p><strong>{profile.nickname}</strong> 님{state.data?'의 차단을 해제할까요?':'을 차단할까요?'}</p><p>{state.data?'서로의 게시글과 댓글을 다시 볼 수 있어요.':'서로의 게시글·댓글·메시지가 보이지 않고 개인 메시지를 보낼 수 없어요. 크루 탈퇴나 회원 강퇴는 아니며, 내 프로필에서 언제든 해제할 수 있어요.'}</p><div><button className="btn btn-primary" disabled={busy} onClick={change}>{busy?'처리 중…':state.data?'해제 확인':'차단하기'}</button><button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirm(false)}>취소</button></div></div>}
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}

